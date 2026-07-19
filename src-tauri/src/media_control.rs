#[cfg(target_os = "windows")]
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSession,
};
use std::sync::Mutex;
use once_cell::sync::Lazy;

struct MediaCache {
    title: String,
    artist: String,
    thumbnail_base64: Option<String>,
}

static CACHE: Lazy<Mutex<MediaCache>> = Lazy::new(|| Mutex::new(MediaCache {
    title: String::new(),
    artist: String::new(),
    thumbnail_base64: None,
}));

/// Full last-known state (incl. thumbnail) for one-shot fetch on widget mount.
static LAST_STATE: Lazy<Mutex<Option<MediaState>>> = Lazy::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
use windows::Storage::Streams::{Buffer, IBuffer, DataReader};

#[derive(serde::Serialize, Clone)]
pub struct MediaState {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub is_playing: bool,
    pub position_ms: u32,
    pub duration_ms: u32,
    pub thumbnail_base64: Option<String>,
}

pub fn get_last_media_state() -> Option<MediaState> {
    LAST_STATE.lock().ok().and_then(|g| g.clone())
}

#[cfg(target_os = "windows")]
pub fn start_media_listener(app_handle: tauri::AppHandle) {
    use tauri::Emitter;
    std::thread::spawn(move || {
        unsafe {
            let _ = windows::Win32::System::Com::CoInitializeEx(None, windows::Win32::System::Com::COINIT_MULTITHREADED);
        }
        
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            loop {
                let manager_result = GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                
                if manager_result.is_err() {
                    if let Ok(mut g) = LAST_STATE.lock() { *g = None; }
                    let _ = app_handle.emit("media_update", None::<MediaState>);
                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                    continue;
                }
                
                let manager_op = manager_result.unwrap();
                let manager = match manager_op.await {
                    Ok(m) => m,
                    Err(_) => {
                        if let Ok(mut g) = LAST_STATE.lock() { *g = None; }
                        let _ = app_handle.emit("media_update", None::<MediaState>);
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };
                    
                let session = match manager.GetCurrentSession() {
                    Ok(s) => s,
                    Err(_) => {
                        if let Ok(mut g) = LAST_STATE.lock() { *g = None; }
                        let _ = app_handle.emit("media_update", None::<MediaState>);
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };
                
                let properties = match session.TryGetMediaPropertiesAsync() {
                    Ok(async_op) => match async_op.await {
                        Ok(p) => p,
                        Err(_) => {
                            if let Ok(mut g) = LAST_STATE.lock() { *g = None; }
                            let _ = app_handle.emit("media_update", None::<MediaState>);
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                            continue;
                        }
                    },
                    Err(_) => {
                        if let Ok(mut g) = LAST_STATE.lock() { *g = None; }
                        let _ = app_handle.emit("media_update", None::<MediaState>);
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };
                
                let title = properties.Title().unwrap_or_default().to_string();
                let artist = properties.Artist().unwrap_or_default().to_string();
                let album = properties.AlbumTitle().unwrap_or_default().to_string();
            
                let playback_info = session.GetPlaybackInfo().ok();
                let is_playing = playback_info
                    .map(|info| {
                        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;
                        info.PlaybackStatus().ok() == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                    })
                    .unwrap_or(false);
                    
                let mut position_ms = 0;
                let mut duration_ms = 0;
                if let Ok(timeline) = session.GetTimelineProperties() {
                    if let Ok(end) = timeline.EndTime() {
                        duration_ms = (end.Duration / 10000) as u32;
                    }
                    if let Ok(pos) = timeline.Position() {
                        let mut calculated_pos = pos.Duration / 10000;
                        
                        if is_playing {
                            if let Ok(last_updated) = timeline.LastUpdatedTime() {
                                if let Ok(now) = std::time::SystemTime::now().duration_since(std::time::SystemTime::UNIX_EPOCH) {
                                    let now_ms = now.as_millis() as i64;
                                    let now_1601_ms = now_ms + 11644473600000;
                                    let last_updated_ms = last_updated.UniversalTime / 10000;
                                    let elapsed_ms = now_1601_ms - last_updated_ms;
                                    
                                    if elapsed_ms > 0 {
                                        calculated_pos += elapsed_ms;
                                    }
                                }
                            }
                        }
                        
                        if calculated_pos > (duration_ms as i64) {
                            calculated_pos = duration_ms as i64;
                        }
                        position_ms = calculated_pos as u32;
                    }
                }
                
                let mut thumbnail_base64 = None;
                let mut track_changed = false;
                
                if let Ok(cache) = CACHE.lock() {
                    if cache.title == title && cache.artist == artist {
                        // Same track: do NOT resend thumbnail over IPC (huge payload every second)
                        track_changed = false;
                    } else {
                        track_changed = true;
                    }
                } else {
                    track_changed = true;
                }
            
                if track_changed {
                    if let Ok(thumbnail_ref) = properties.Thumbnail() {
                        if let Ok(async_op) = thumbnail_ref.OpenReadAsync() {
                            if let Ok(stream) = async_op.await {
                                let size = stream.Size().unwrap_or(0);
                                
                                let content_type = stream.ContentType().unwrap_or_default().to_string();
                                let mime_type = if content_type.is_empty() {
                                    "image/jpeg".to_string()
                                } else if content_type.contains("png") {
                                    "image/png".to_string()
                                } else if content_type.contains("gif") {
                                    "image/gif".to_string()
                                } else if content_type.contains("webp") {
                                    "image/webp".to_string()
                                } else {
                                    if let Some(first) = content_type.split(',').next() {
                                        first.trim().to_string()
                                    } else {
                                        "image/jpeg".to_string()
                                    }
                                };
            
                                // Cap cover size harder — base64 balloons ~33% and is sent to every webview
                                if size > 0 && size < 512 * 1024 {
                                    if let Ok(buffer) = Buffer::Create(size as u32) {
                                        let read_op = stream.ReadAsync(&buffer, size as u32, windows::Storage::Streams::InputStreamOptions::None);
                                        if let Ok(read_result) = read_op {
                                            if let Ok(res_buf) = read_result.await {
                                                if let Ok(data_reader) = DataReader::FromBuffer(&res_buf) {
                                                    let mut bytes = vec![0u8; size as usize];
                                                    if data_reader.ReadBytes(&mut bytes).is_ok() {
                                                        use base64::{Engine as _, engine::general_purpose};
                                                        let base64_str = general_purpose::STANDARD.encode(&bytes);
                                                        thumbnail_base64 = Some(format!("data:{};base64,{}", mime_type, base64_str));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if let Ok(mut cache) = CACHE.lock() {
                        cache.title = title.clone();
                        cache.artist = artist.clone();
                        cache.thumbnail_base64 = thumbnail_base64.clone();
                    }
                }
                
                // Keep a full snapshot (with cover) for late-mounting widgets
                let full_thumbnail = if track_changed {
                    thumbnail_base64.clone()
                } else {
                    CACHE.lock().ok().and_then(|c| c.thumbnail_base64.clone())
                };
                let full_state = MediaState {
                    title: title.clone(),
                    artist: artist.clone(),
                    album: album.clone(),
                    is_playing,
                    position_ms,
                    duration_ms,
                    thumbnail_base64: full_thumbnail,
                };
                if let Ok(mut g) = LAST_STATE.lock() {
                    *g = Some(full_state);
                }

                let state = MediaState {
                    title,
                    artist,
                    album,
                    is_playing,
                    position_ms,
                    duration_ms,
                    // Only include thumbnail when the track changed; periodic ticks stay tiny
                    thumbnail_base64,
                };
                
                let _ = app_handle.emit("media_update", Some(state));
                
                tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
            }
        });
    });
}

#[cfg(target_os = "windows")]
pub fn send_media_command(command: &str, seek_pos_ms: Option<u32>) -> Result<(), String> {
    let command = command.to_string();
    std::thread::spawn(move || {
        unsafe {
            let _ = windows::Win32::System::Com::CoInitializeEx(None, windows::Win32::System::Com::COINIT_MULTITHREADED);
        }
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
                .map_err(|e| format!("Failed to request session manager: {}", e))?
                .await
                .map_err(|e| format!("Failed to get session manager: {}", e))?;
        
    let session = match manager.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => return Err("No active media session found".to_string()),
    };
    
    match command.as_str() {
        "play" => {
            let _ = session.TryPlayAsync()
                .map_err(|e| format!("Failed to init play: {}", e))?
                .await
                .map_err(|e| format!("Failed to execute play: {}", e))?;
        }
        "pause" => {
            let _ = session.TryPauseAsync()
                .map_err(|e| format!("Failed to init pause: {}", e))?
                .await
                .map_err(|e| format!("Failed to execute pause: {}", e))?;
        }
        "toggle" => {
            let _ = session.TryTogglePlayPauseAsync()
                .map_err(|e| format!("Failed to init toggle: {}", e))?
                .await
                .map_err(|e| format!("Failed to execute toggle: {}", e))?;
        }
        "next" => {
            let _ = session.TrySkipNextAsync()
                .map_err(|e| format!("Failed to init next: {}", e))?
                .await
                .map_err(|e| format!("Failed to execute next: {}", e))?;
        }
        "prev" => {
            let _ = session.TrySkipPreviousAsync()
                .map_err(|e| format!("Failed to init prev: {}", e))?
                .await
                .map_err(|e| format!("Failed to execute prev: {}", e))?;
        }
        "seek" => {
            if let Some(ms) = seek_pos_ms {
                let _ = session.TryChangePlaybackPositionAsync((ms as i64) * 10000)
                    .map_err(|e| format!("Failed to init seek: {}", e))?
                    .await
                    .map_err(|e| format!("Failed to execute seek: {}", e))?;
            }
        }
        _ => return Err(format!("Invalid media command received: {}", command)),
    }
    
    Ok(())
    })
    }).join().unwrap_or(Err("Thread panicked".to_string()))
}

#[cfg(target_os = "windows")]
pub fn get_current_media_state() -> Result<Option<MediaState>, String> {
    Ok(get_last_media_state())
}

#[cfg(not(target_os = "windows"))]
pub fn get_current_media_state() -> Result<Option<MediaState>, String> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub async fn send_media_command(_command: &str, _seek_pos_ms: Option<u32>) -> Result<(), String> {
    // Dummy fallback for non-Windows platforms
    Ok(())
}