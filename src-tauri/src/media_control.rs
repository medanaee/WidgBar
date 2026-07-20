#[cfg(target_os = "windows")]
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use std::path::PathBuf;
use tauri::Emitter;

#[derive(serde::Serialize, Clone)]
pub struct MediaTrackEvent {
    pub title: String,
    pub artist: String,
    pub duration_ms: u32,
}

#[derive(serde::Serialize, Clone)]
pub struct MediaPlaybackEvent {
    pub is_playing: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct MediaPositionEvent {
    pub position_ms: u32,
}

struct MediaState {
    title: String,
    artist: String,
    duration_ms: u32,
    is_playing: bool,
    last_cover_hash: u64,
    last_cover_path: Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct MediaSnapshot {
    pub title: String,
    pub artist: String,
    pub duration_ms: u32,
    pub is_playing: bool,
    pub cover_path: Option<String>,
}

static STATE: Lazy<Mutex<MediaState>> = Lazy::new(|| Mutex::new(MediaState {
    title: String::new(),
    artist: String::new(),
    duration_ms: 0,
    is_playing: false,
    last_cover_hash: 0,
    last_cover_path: None,
}));

static COVER_DIR: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
use windows::Storage::Streams::{Buffer, DataReader};

fn hash_bytes(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100000001b3);
    }
    h ^= bytes.len() as u64;
    h
}

fn manage_cover_cache() {
    let dir = match COVER_DIR.lock().unwrap().clone() {
        Some(d) => d,
        None => return,
    };
    
    if let Ok(entries) = std::fs::read_dir(&dir) {
        let mut files: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        if files.len() > 100 {
            files.sort_by_key(|a| a.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH));
            for file in files.iter().take(files.len() - 90) {
                let _ = std::fs::remove_file(file.path());
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn start_media_listener(app_handle: tauri::AppHandle) {
    use tauri::Manager;

    if let Ok(dir) = app_handle.path().app_cache_dir() {
        let cover_dir = dir.join("media_covers");
        let _ = std::fs::create_dir_all(&cover_dir);
        if let Ok(mut g) = COVER_DIR.lock() {
            *g = Some(cover_dir);
        }
    }

    std::thread::spawn(move || {
        unsafe {
            // 2. PRINCIPLED FIX: Use RoInitialize instead of CoInitializeEx.
            // SMTC (Media Controls) is a WinRT API. WinRT components must be initialized 
            // using RoInitialize to correctly handle threading models (MTA) without crashing.
            let _ = windows::Win32::System::WinRT::RoInitialize(
                windows::Win32::System::WinRT::RO_INIT_MULTITHREADED,
            );
        }

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
            use windows::Storage::Streams::{Buffer, DataReader};

            let mut cached_manager: Option<GlobalSystemMediaTransportControlsSessionManager> = None;
            let mut cached_session_id = String::new();
            
            let mut cover_pending = false;
            let mut cover_deadline = std::time::Instant::now();

            loop {
                let start_time = std::time::Instant::now();

                let manager = match cached_manager.as_ref() {
                    Some(m) => m,
                    None => {
                        // The code you uncommented goes back here. It is now safe to call.
                        match GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                            Ok(op) => match op.await {
                                Ok(m) => {
                                    cached_manager = Some(m);
                                    cached_manager.as_ref().unwrap()
                                }
                                Err(_) => {
                                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                                    continue;
                                }
                            },
                            Err(_) => {
                                tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                                continue;
                            }
                        }
                    }
                };

                let session = match manager.GetCurrentSession() {
                    Ok(s) => s,
                    Err(_) => {
                        let mut state = STATE.lock().unwrap();
                        if !state.title.is_empty() || !state.artist.is_empty() {
                            state.title.clear();
                            state.artist.clear();
                            state.duration_ms = 0;
                            state.is_playing = false;
                            state.last_cover_hash = 0;
                            state.last_cover_path = None;
                            
                            let _ = app_handle.emit("media_track", MediaTrackEvent {
                                title: String::new(),
                                artist: String::new(),
                                duration_ms: 0,
                            });
                            let _ = app_handle.emit("media_cover", None::<String>);
                            let _ = app_handle.emit("media_playback", MediaPlaybackEvent { is_playing: false });
                        }
                        cover_pending = false;
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };

                let current_app_id = session.SourceAppUserModelId().unwrap_or_default().to_string();
                if current_app_id != cached_session_id {
                    cached_session_id = current_app_id.clone();
                }

                let mut title = String::new();
                let mut artist = String::new();
                let mut props_opt = None;

                if let Ok(op) = session.TryGetMediaPropertiesAsync() {
                    if let Ok(props) = op.await {
                        title = props.Title().unwrap_or_default().to_string();
                        artist = props.Artist().unwrap_or_default().to_string();
                        props_opt = Some(props);
                    }
                }

                if title.is_empty() && artist.is_empty() {
                    let mut state = STATE.lock().unwrap();
                    if !state.title.is_empty() || !state.artist.is_empty() {
                        state.title.clear();
                        state.artist.clear();
                        state.duration_ms = 0;
                        state.is_playing = false;
                        state.last_cover_hash = 0;
                        state.last_cover_path = None;
                        
                        let _ = app_handle.emit("media_track", MediaTrackEvent {
                            title: String::new(),
                            artist: String::new(),
                            duration_ms: 0,
                        });
                        let _ = app_handle.emit("media_cover", None::<String>);
                        let _ = app_handle.emit("media_playback", MediaPlaybackEvent { is_playing: false });
                    }
                    cover_pending = false;
                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                    continue;
                }

                let playback_info = session.GetPlaybackInfo().ok();
                let is_playing = playback_info
                    .map(|info| {
                        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;
                        info.PlaybackStatus().ok() == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                    })
                    .unwrap_or(false);

                let mut duration_ms = 0u32;
                let mut position_ms = 0u32;
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

                // `track_switched` (title/artist) => it's really a new song, refetch the cover.
                // `meta_changed` (also duration) => just re-emit media_track so the progress bar
                // updates; duration alone often jitters on the same track, so it must NOT reopen
                // the cover window (that caused the cover to vanish after the retry window).
                let mut track_switched = false;
                let mut meta_changed = false;
                let mut playback_changed = false;

                {
                    let mut state = STATE.lock().unwrap();
                    if state.title != title || state.artist != artist {
                        track_switched = true;
                    }
                    if state.title != title || state.artist != artist || state.duration_ms != duration_ms {
                        state.title = title.clone();
                        state.artist = artist.clone();
                        state.duration_ms = duration_ms;
                        meta_changed = true;
                    }
                    if state.is_playing != is_playing {
                        state.is_playing = is_playing;
                        playback_changed = true;
                    }
                }

                if meta_changed {
                    let _ = app_handle.emit("media_track", MediaTrackEvent {
                        title: title.clone(),
                        artist: artist.clone(),
                        duration_ms,
                    });
                }

                if track_switched {
                    // Open a retry window for the cover. The previous track's hash stays in
                    // STATE.last_cover_hash so we can tell "same old art (lag)" from "fresh art".
                    cover_pending = true;
                    cover_deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
                }

                // Cover fetch runs inline (WinRT types are not Send, so no tokio::spawn).
                // Runs every second while pending until fresh art shows up or we give up.
                // Emitted result: Some(path) => show it, None => no image (frontend clears).
                if cover_pending {
                    let prev_hash = STATE.lock().unwrap().last_cover_hash;

                    // Distinguish: NoArt (Windows says none) | Bytes(fresh) | Wait (lag/stale/transient).
                    enum CoverAttempt {
                        NoArt,
                        Bytes(Vec<u8>, u64),
                        Wait,
                    }

                    let attempt = match props_opt.as_ref() {
                        None => CoverAttempt::Wait,
                        Some(props) => match props.Thumbnail() {
                            Err(_) => CoverAttempt::NoArt,
                            Ok(thumb_ref) => {
                                let bytes_opt: Option<Vec<u8>> = 'read: {
                                    let async_op = match thumb_ref.OpenReadAsync() {
                                        Ok(o) => o,
                                        Err(_) => break 'read None,
                                    };
                                    let stream = match async_op.await {
                                        Ok(s) => s,
                                        Err(_) => break 'read None,
                                    };
                                    let size = stream.Size().unwrap_or(0);
                                    if size == 0 || size >= 10 * 1024 * 1024 {
                                        break 'read None;
                                    }
                                    let buffer = match Buffer::Create(size as u32) {
                                        Ok(b) => b,
                                        Err(_) => break 'read None,
                                    };
                                    let read_op = match stream.ReadAsync(&buffer, size as u32, windows::Storage::Streams::InputStreamOptions::None) {
                                        Ok(r) => r,
                                        Err(_) => break 'read None,
                                    };
                                    let res_buf = match read_op.await {
                                        Ok(r) => r,
                                        Err(_) => break 'read None,
                                    };
                                    let data_reader = match DataReader::FromBuffer(&res_buf) {
                                        Ok(d) => d,
                                        Err(_) => break 'read None,
                                    };
                                    let mut bytes = vec![0u8; size as usize];
                                    if data_reader.ReadBytes(&mut bytes).is_err() {
                                        break 'read None;
                                    }
                                    Some(bytes)
                                };
                                match bytes_opt {
                                    None => CoverAttempt::Wait,
                                    Some(bytes) => {
                                        let h = hash_bytes(&bytes);
                                        // Same bytes as the previous track => SMTC lag, keep waiting.
                                        if h == prev_hash && h != 0 {
                                            CoverAttempt::Wait
                                        } else {
                                            CoverAttempt::Bytes(bytes, h)
                                        }
                                    }
                                }
                            }
                        },
                    };

                    // decision: Some(x) => emit (x = path, or None for "no image"); None => keep waiting.
                    // close_silently: end the retry window WITHOUT emitting (keep current cover).
                    let mut decision: Option<Option<String>> = None;
                    let mut close_silently = false;
                    match attempt {
                        CoverAttempt::NoArt => decision = Some(None),
                        CoverAttempt::Bytes(bytes, h) => {
                            // Bind to a local so the COVER_DIR MutexGuard is released here;
                            // otherwise the guard lives for the whole `if let` body and
                            // manage_cover_cache() (which locks COVER_DIR again) deadlocks.
                            let cover_dir = COVER_DIR.lock().unwrap().clone();
                            if let Some(dir) = cover_dir {
                                match image::load_from_memory(&bytes) {
                                    Ok(img) => {
                                        // JPEG can't hold an alpha channel — drop it to RGB8 first.
                                        let thumb = img.thumbnail(300, 300).to_rgb8();
                                        let path = dir.join(format!("{}.jpg", h));
                                        match thumb.save_with_format(&path, image::ImageFormat::Jpeg) {
                                            Ok(_) => {
                                                let path_str = path.to_string_lossy().to_string();
                                                {
                                                    let mut state = STATE.lock().unwrap();
                                                    state.last_cover_hash = h;
                                                    state.last_cover_path = Some(path_str.clone());
                                                }
                                                decision = Some(Some(path_str));
                                                manage_cover_cache();
                                            }
                                            Err(_) => decision = Some(None),
                                        }
                                    }
                                    Err(_) => decision = Some(None),
                                }
                            } else {
                                decision = Some(None);
                            }
                        }
                        CoverAttempt::Wait => {}
                    }

                    // Give up once the retry window elapses.
                    if decision.is_none() && !close_silently && std::time::Instant::now() >= cover_deadline {
                        if STATE.lock().unwrap().last_cover_hash != 0 {
                            // No new art arrived, but a valid cover is already on screen (same
                            // track / metadata jitter / transient glitch). Keep it, don't clear.
                            close_silently = true;
                        } else {
                            decision = Some(None);
                        }
                    }

                    if let Some(result) = decision {
                        if result.is_none() {
                            let mut state = STATE.lock().unwrap();
                            state.last_cover_hash = 0;
                            state.last_cover_path = None;
                        }
                        // None => JSON null => frontend clears the cover.
                        let _ = app_handle.emit("media_cover", result);
                        cover_pending = false;
                    } else if close_silently {
                        cover_pending = false;
                    }
                }

                if playback_changed {
                    let _ = app_handle.emit("media_playback", MediaPlaybackEvent { is_playing });
                }

                if is_playing {
                    let _ = app_handle.emit("media_position", MediaPositionEvent { position_ms });
                }

                let elapsed = start_time.elapsed();
                if elapsed < std::time::Duration::from_millis(1000) {
                    tokio::time::sleep(std::time::Duration::from_millis(1000) - elapsed).await;
                }
            }
        });
    });
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_media_snapshot() -> MediaSnapshot {
    let state = STATE.lock().unwrap();
    MediaSnapshot {
        title: state.title.clone(),
        artist: state.artist.clone(),
        duration_ms: state.duration_ms,
        is_playing: state.is_playing,
        cover_path: state.last_cover_path.clone(),
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn send_media_command(command: &str, seek_pos_ms: Option<u32>) -> Result<(), String> {
    let command = command.to_string();
    std::thread::spawn(move || {
        unsafe {
            let _ = windows::Win32::System::Com::CoInitializeEx(
                None,
                windows::Win32::System::Com::COINIT_MULTITHREADED,
            );
        }
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
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
                        .await;
                }
                "pause" => {
                    let _ = session.TryPauseAsync()
                        .map_err(|e| format!("Failed to init pause: {}", e))?
                        .await;
                }
                "toggle" => {
                    let _ = session.TryTogglePlayPauseAsync()
                        .map_err(|e| format!("Failed to init toggle: {}", e))?
                        .await;
                }
                "next" => {
                    let _ = session.TrySkipNextAsync()
                        .map_err(|e| format!("Failed to init next: {}", e))?
                        .await;
                }
                "prev" => {
                    let _ = session.TrySkipPreviousAsync()
                        .map_err(|e| format!("Failed to init prev: {}", e))?
                        .await;
                }
                "seek" => {
                    if let Some(pos_ms) = seek_pos_ms {
                        let _ = session.TryChangePlaybackPositionAsync((pos_ms as i64) * 10000)
                            .map_err(|e| format!("Failed to init seek: {}", e))?
                            .await;
                    }
                }
                _ => return Err(format!("Unknown command: {}", command)),
            }
            Ok(())
        })
    }).join().unwrap_or(Err("Thread panicked".to_string()))
}