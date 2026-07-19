#[cfg(target_os = "windows")]
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use std::path::PathBuf;

/// Lightweight playback snapshot — never includes image bytes.
#[derive(serde::Serialize, Clone, PartialEq)]
pub struct MediaTick {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub is_playing: bool,
    pub position_ms: u32,
    pub duration_ms: u32,
    /// Bumps when title/artist change so the UI can fetch cover once.
    pub track_seq: u64,
    pub has_cover: bool,
    /// True once we know for sure (cover ready OR confirmed none).
    /// While false, UI may keep showing the previous track's art (smooth swap).
    pub cover_settled: bool,
}

struct CoverCache {
    track_seq: u64,
    title: String,
    artist: String,
    album: String,
    /// Raw image bytes on disk (path) — not held as base64 in memory for IPC.
    path: Option<PathBuf>,
    mime: String,
    /// Hash of the last accepted cover (to reject Windows SMTC stale thumbnails).
    last_hash: u64,
    /// Album title that last_hash belonged to (same-album art is allowed to repeat).
    last_album: String,
    /// After a track change, identical bytes to last_hash are treated as stale until this instant.
    reject_stale_until: Option<std::time::Instant>,
    /// Whether we already successfully bound a cover to this track_seq.
    cover_ready: bool,
    /// Gave up fetching for this track (stale SMTC art, or no thumbnail).
    fetch_exhausted: bool,
}

struct LastTick {
    tick: Option<MediaTick>,
    /// Avoid spamming null clears to every webview.
    cleared: bool,
}

static COVER: Lazy<Mutex<CoverCache>> = Lazy::new(|| Mutex::new(CoverCache {
    track_seq: 0,
    title: String::new(),
    artist: String::new(),
    album: String::new(),
    path: None,
    mime: String::new(),
    last_hash: 0,
    last_album: String::new(),
    reject_stale_until: None,
    cover_ready: false,
    fetch_exhausted: false,
}));

static LAST: Lazy<Mutex<LastTick>> = Lazy::new(|| Mutex::new(LastTick {
    tick: None,
    cleared: true,
}));

static COVER_DIR: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
use windows::Storage::Streams::{Buffer, DataReader};

fn hash_bytes(bytes: &[u8]) -> u64 {
    // Cheap FNV-1a style hash — enough to detect "same thumbnail as before"
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100000001b3);
    }
    h ^= bytes.len() as u64;
    h
}

pub fn get_last_media_tick() -> Option<MediaTick> {
    LAST.lock().ok().and_then(|g| g.tick.clone())
}

/// One-shot cover as data URL — only on track change / mount, never on the poll loop.
pub fn get_media_cover_data_url() -> Result<Option<String>, String> {
    let (path, mime) = {
        let cache = COVER.lock().map_err(|e| e.to_string())?;
        match &cache.path {
            Some(p) => (p.clone(), cache.mime.clone()),
            None => return Ok(None),
        }
    };
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read cover: {e}"))?;
    use base64::{engine::general_purpose, Engine as _};
    let b64 = general_purpose::STANDARD.encode(&bytes);
    let mime = if mime.is_empty() {
        "image/jpeg".to_string()
    } else {
        mime
    };
    Ok(Some(format!("data:{mime};base64,{b64}")))
}

fn set_cover_dir(dir: PathBuf) {
    if let Ok(mut g) = COVER_DIR.lock() {
        *g = Some(dir);
    }
}

fn cover_file_path(ext: &str) -> Option<PathBuf> {
    let dir = COVER_DIR.lock().ok()?.clone()?;
    Some(dir.join(format!("media_cover.{ext}")))
}

fn clear_cover_cache() {
    if let Ok(mut cache) = COVER.lock() {
        if let Some(path) = cache.path.take() {
            let _ = std::fs::remove_file(path);
        }
        cache.mime.clear();
        cache.title.clear();
        cache.artist.clear();
        cache.album.clear();
        cache.cover_ready = false;
        cache.fetch_exhausted = false;
        cache.reject_stale_until = None;
    }
}

fn write_cover_bytes(bytes: &[u8], mime: &str) -> Option<PathBuf> {
    let ext = if mime.contains("png") {
        "png"
    } else if mime.contains("gif") {
        "gif"
    } else if mime.contains("webp") {
        "webp"
    } else {
        "jpg"
    };
    let path = cover_file_path(ext)?;
    // Remove previous cover files with other extensions
    for old_ext in ["jpg", "png", "gif", "webp"] {
        if let Some(p) = cover_file_path(old_ext) {
            let _ = std::fs::remove_file(p);
        }
    }
    std::fs::write(&path, bytes).ok()?;
    Some(path)
}

#[cfg(target_os = "windows")]
pub fn start_media_listener(app_handle: tauri::AppHandle) {
    use tauri::{Emitter, Manager};

    if let Ok(dir) = app_handle.path().app_cache_dir() {
        let cover_dir = dir.join("media");
        let _ = std::fs::create_dir_all(&cover_dir);
        set_cover_dir(cover_dir);
    }

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
            loop {
                let clear_session = |app: &tauri::AppHandle| {
                    let should_emit = {
                        if let Ok(mut g) = LAST.lock() {
                            let emit = !g.cleared;
                            g.tick = None;
                            g.cleared = true;
                            emit
                        } else {
                            true
                        }
                    };
                    if should_emit {
                        clear_cover_cache();
                        let _ = app.emit("media_tick", None::<MediaTick>);
                    }
                };

                let manager = match GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                    Ok(op) => match op.await {
                        Ok(m) => m,
                        Err(_) => {
                            clear_session(&app_handle);
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                            continue;
                        }
                    },
                    Err(_) => {
                        clear_session(&app_handle);
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };

                let session = match manager.GetCurrentSession() {
                    Ok(s) => s,
                    Err(_) => {
                        clear_session(&app_handle);
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };

                let properties = match session.TryGetMediaPropertiesAsync() {
                    Ok(op) => match op.await {
                        Ok(p) => p,
                        Err(_) => {
                            clear_session(&app_handle);
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                            continue;
                        }
                    },
                    Err(_) => {
                        clear_session(&app_handle);
                        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        continue;
                    }
                };

                let title = properties.Title().unwrap_or_default().to_string();
                let artist = properties.Artist().unwrap_or_default().to_string();
                let album = properties.AlbumTitle().unwrap_or_default().to_string();

                if title.is_empty() && artist.is_empty() {
                    clear_session(&app_handle);
                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                    continue;
                }

                let playback_info = session.GetPlaybackInfo().ok();
                let is_playing = playback_info
                    .map(|info| {
                        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;
                        info.PlaybackStatus().ok()
                            == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                    })
                    .unwrap_or(false);

                let mut position_ms = 0u32;
                let mut duration_ms = 0u32;
                if let Ok(timeline) = session.GetTimelineProperties() {
                    if let Ok(end) = timeline.EndTime() {
                        duration_ms = (end.Duration / 10000) as u32;
                    }
                    if let Ok(pos) = timeline.Position() {
                        let mut calculated_pos = pos.Duration / 10000;

                        if is_playing {
                            if let Ok(last_updated) = timeline.LastUpdatedTime() {
                                if let Ok(now) = std::time::SystemTime::now()
                                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                {
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

                let mut track_changed = false;
                let mut cover_just_ready = false;
                let (track_seq, mut has_cover) = {
                    let mut cache = match COVER.lock() {
                        Ok(c) => c,
                        Err(_) => {
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                            continue;
                        }
                    };

                    if cache.title == title && cache.artist == artist {
                        (cache.track_seq, cache.cover_ready)
                    } else {
                        track_changed = true;
                        cache.track_seq = cache.track_seq.wrapping_add(1);
                        cache.title = title.clone();
                        cache.artist = artist.clone();
                        cache.album = album.clone();
                        // Drop previous cover immediately — Windows often still serves the old
                        // thumbnail for a second after the title flips.
                        if let Some(old) = cache.path.take() {
                            let _ = std::fs::remove_file(old);
                        }
                        cache.mime.clear();
                        cache.cover_ready = false;
                        cache.fetch_exhausted = false;
                        cache.reject_stale_until =
                            Some(std::time::Instant::now() + std::time::Duration::from_secs(3));
                        (cache.track_seq, false)
                    }
                };

                // Never read thumbnail on the same tick as the title change — SMTC lags.
                let should_try_cover = {
                    if let Ok(cache) = COVER.lock() {
                        !cache.cover_ready
                            && !cache.fetch_exhausted
                            && cache.title == title
                            && cache.artist == artist
                            && !track_changed
                    } else {
                        false
                    }
                };

                if should_try_cover {
                    let mut got_bytes: Option<(Vec<u8>, String)> = None;

                    if let Ok(thumbnail_ref) = properties.Thumbnail() {
                        if let Ok(async_op) = thumbnail_ref.OpenReadAsync() {
                            if let Ok(stream) = async_op.await {
                                let size = stream.Size().unwrap_or(0);
                                let content_type =
                                    stream.ContentType().unwrap_or_default().to_string();
                                let mime_type = if content_type.is_empty() {
                                    "image/jpeg".to_string()
                                } else if content_type.contains("png") {
                                    "image/png".to_string()
                                } else if content_type.contains("gif") {
                                    "image/gif".to_string()
                                } else if content_type.contains("webp") {
                                    "image/webp".to_string()
                                } else if let Some(first) = content_type.split(',').next() {
                                    first.trim().to_string()
                                } else {
                                    "image/jpeg".to_string()
                                };

                                if size > 0 && size < 5 * 1024 * 1024 {
                                    if let Ok(buffer) = Buffer::Create(size as u32) {
                                        if let Ok(read_op) = stream.ReadAsync(
                                            &buffer,
                                            size as u32,
                                            windows::Storage::Streams::InputStreamOptions::None,
                                        ) {
                                            if let Ok(res_buf) = read_op.await {
                                                if let Ok(data_reader) =
                                                    DataReader::FromBuffer(&res_buf)
                                                {
                                                    let mut bytes = vec![0u8; size as usize];
                                                    if data_reader.ReadBytes(&mut bytes).is_ok() {
                                                        got_bytes = Some((bytes, mime_type));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if let Some((bytes, mime_type)) = got_bytes {
                        let new_hash = hash_bytes(&bytes);
                        let accept = {
                            if let Ok(cache) = COVER.lock() {
                                if cache.last_hash == 0 || new_hash != cache.last_hash {
                                    // Different image than last track — always accept
                                    true
                                } else if !cache.last_album.is_empty()
                                    && cache.last_album == album
                                {
                                    // Same bytes but same album — legitimate shared art
                                    true
                                } else {
                                    // Same bytes as previous track, different album/empty:
                                    // SMTC is still serving stale art — never accept for this track
                                    false
                                }
                            } else {
                                true
                            }
                        };

                        if accept {
                            if let Some(path) = write_cover_bytes(&bytes, &mime_type) {
                                if let Ok(mut cache) = COVER.lock() {
                                    cache.path = Some(path);
                                    cache.mime = mime_type;
                                    cache.last_hash = new_hash;
                                    cache.last_album = album.clone();
                                    cache.cover_ready = true;
                                    cache.fetch_exhausted = false;
                                    cache.reject_stale_until = None;
                                    has_cover = true;
                                    cover_just_ready = true;
                                }
                            }
                        } else if let Ok(mut cache) = COVER.lock() {
                            // Stale duplicate — keep retrying only inside the window, then give up
                            let give_up = cache
                                .reject_stale_until
                                .map(|t| std::time::Instant::now() >= t)
                                .unwrap_or(true);
                            if give_up {
                                cache.fetch_exhausted = true;
                                cache.reject_stale_until = None;
                            }
                        }
                    } else if let Ok(mut cache) = COVER.lock() {
                        // No thumbnail stream — give up after the settle window
                        let give_up = cache
                            .reject_stale_until
                            .map(|t| std::time::Instant::now() >= t)
                            .unwrap_or(true);
                        if give_up {
                            cache.fetch_exhausted = true;
                            cache.reject_stale_until = None;
                        }
                    }
                }

                let tick = MediaTick {
                    title,
                    artist,
                    album,
                    is_playing,
                    position_ms,
                    duration_ms,
                    track_seq,
                    has_cover,
                    cover_settled: {
                        if let Ok(cache) = COVER.lock() {
                            cache.cover_ready || cache.fetch_exhausted
                        } else {
                            false
                        }
                    },
                };

                // Skip identical ticks (paused + same position) to cut IPC noise
                let should_emit = {
                    if let Ok(mut g) = LAST.lock() {
                        let emit = match &g.tick {
                            Some(prev) => {
                                prev.track_seq != tick.track_seq
                                    || prev.is_playing != tick.is_playing
                                    || prev.title != tick.title
                                    || prev.artist != tick.artist
                                    || prev.album != tick.album
                                    || prev.duration_ms != tick.duration_ms
                                    || prev.has_cover != tick.has_cover
                                    || prev.cover_settled != tick.cover_settled
                                    || (tick.is_playing
                                        && prev.position_ms.abs_diff(tick.position_ms) >= 400)
                                    || (!tick.is_playing && prev.position_ms != tick.position_ms)
                            }
                            None => true,
                        };
                        g.tick = Some(tick.clone());
                        g.cleared = false;
                        emit
                    } else {
                        true
                    }
                };

                if should_emit {
                    let _ = app_handle.emit("media_tick", Some(tick));
                    if cover_just_ready {
                        let _ = app_handle.emit("media_cover_ready", track_seq);
                    }
                }

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
                    let _ = session
                        .TryPlayAsync()
                        .map_err(|e| format!("Failed to init play: {}", e))?
                        .await
                        .map_err(|e| format!("Failed to execute play: {}", e))?;
                }
                "pause" => {
                    let _ = session
                        .TryPauseAsync()
                        .map_err(|e| format!("Failed to init pause: {}", e))?
                        .await
                        .map_err(|e| format!("Failed to execute pause: {}", e))?;
                }
                "toggle" => {
                    let _ = session
                        .TryTogglePlayPauseAsync()
                        .map_err(|e| format!("Failed to init toggle: {}", e))?
                        .await
                        .map_err(|e| format!("Failed to execute toggle: {}", e))?;
                }
                "next" => {
                    let _ = session
                        .TrySkipNextAsync()
                        .map_err(|e| format!("Failed to init next: {}", e))?
                        .await
                        .map_err(|e| format!("Failed to execute next: {}", e))?;
                }
                "prev" => {
                    let _ = session
                        .TrySkipPreviousAsync()
                        .map_err(|e| format!("Failed to init prev: {}", e))?
                        .await
                        .map_err(|e| format!("Failed to execute prev: {}", e))?;
                }
                "seek" => {
                    if let Some(ms) = seek_pos_ms {
                        let _ = session
                            .TryChangePlaybackPositionAsync((ms as i64) * 10000)
                            .map_err(|e| format!("Failed to init seek: {}", e))?
                            .await
                            .map_err(|e| format!("Failed to execute seek: {}", e))?;
                    }
                }
                _ => return Err(format!("Invalid media command received: {}", command)),
            }

            Ok(())
        })
    })
    .join()
    .unwrap_or(Err("Thread panicked".to_string()))
}

#[cfg(target_os = "windows")]
pub fn get_current_media_state() -> Result<Option<MediaTick>, String> {
    Ok(get_last_media_tick())
}

#[cfg(not(target_os = "windows"))]
pub fn get_current_media_state() -> Result<Option<MediaTick>, String> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub fn get_media_cover_data_url() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub fn start_media_listener(_app_handle: tauri::AppHandle) {}

#[cfg(not(target_os = "windows"))]
pub fn send_media_command(_command: &str, _seek_pos_ms: Option<u32>) -> Result<(), String> {
    Ok(())
}
