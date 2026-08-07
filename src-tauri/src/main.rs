#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::fs;

use tauri::Listener;
use tauri::Manager;
use tauri::Emitter;


mod windows_utils;
use windows_utils::*;
mod listener;

mod acrylic_layer;
use acrylic_layer::*;

use std::collections::{HashMap, HashSet};

mod windows_pool;
use crate::windows_pool::*;

mod database;
use crate::database::*;

mod audio_control;
mod media_control;
mod clipboard_history;
mod clipboard_hook;
mod fullscreen_detector;

mod system_monitor;

static WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Background watchers (media + clipboard) must only ever be started once for
/// the whole process lifetime, regardless of how many times the main window is
/// opened/closed or how the app is re-launched.
static WATCHERS_STARTED: AtomicBool = AtomicBool::new(false);
/// Monotonic suffix so freshly generated bar-widget ids never collide.
static BAR_ID_COUNTER: AtomicUsize = AtomicUsize::new(0);


#[tauri::command]
fn save_attachment_file(app: tauri::AppHandle, session_id: String, file_name: String, content: String) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
        
    let attach_dir = app_data_dir.join("attachments").join(&session_id);
    if !attach_dir.exists() {
        fs::create_dir_all(&attach_dir).map_err(|e| e.to_string())?;
    }
    
    let mut h: u64 = 0xcbf29ce484222325;
    let bytes = content.as_bytes();
    for b in bytes.iter().step_by(std::cmp::max(1, bytes.len() / 4096)) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100000001b3);
    }
    h ^= bytes.len() as u64;
    let hash_str = format!("{:016x}", h);
    
    let safe_name: String = file_name.chars().filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_').collect();
    let target_path = attach_dir.join(format!("{}_{}", hash_str, safe_name));
    
    fs::write(&target_path, content).map_err(|e| e.to_string())?;
    
    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_attachment_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

fn start_watchers_once(app: tauri::AppHandle) {
    if WATCHERS_STARTED.swap(true, Ordering::SeqCst) {
        println!("[system] Watchers already started; skipping.");
        return;
    }
    println!("[system] Starting background watchers...");
    media_control::start_media_listener(app.clone());
    clipboard_history::start_clipboard_watcher(app);
}

fn gen_bar_widget_id() -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let c = BAR_ID_COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("bar_widget_{}_{}", ms, c)
}

/// Reconcile the persisted `default` layout against the physically connected
/// monitors (mirrors the logic that used to live in `App.tsx`): mark
/// disconnected / reconnected monitors, add newly connected ones, update
/// geometry / primary flag, and ensure the primary monitor always has a bar.
///
/// Returns the list of connected monitors together with whether each needs a
/// bar and/or a widget-area window created.
async fn reconcile_layout_and_collect(app: &tauri::AppHandle) -> Vec<(String, bool, bool)> {
    let backend_monitors: Vec<crate::acrylic_layer::MonitorInfo> = crate::acrylic_layer::get_layout_state()
        .lock()
        .unwrap()
        .monitors
        .values()
        .cloned()
        .collect();

    let layouts = crate::database::load_all_layouts(app.clone())
        .await
        .unwrap_or_default();
    let raw = layouts
        .get("default")
        .cloned()
        .unwrap_or_else(|| "{}".to_string());
    let mut parsed: serde_json::Value =
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
    if !parsed.is_object() {
        parsed = serde_json::json!({});
    }

    let mut monitors: Vec<serde_json::Value> = parsed
        .get("monitors")
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();

    let mut changed = false;

    // 1. Mark disconnected / reconnected monitors.
    for m in monitors.iter_mut() {
        let mid = m.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let still_connected = backend_monitors.iter().any(|bm| bm.id == mid);
        let is_disc = m
            .get("is_disconnected")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !still_connected {
            if !is_disc {
                m["is_disconnected"] = serde_json::json!(true);
                changed = true;
            }
        } else if is_disc {
            m["is_disconnected"] = serde_json::json!(false);
            changed = true;
        }
    }

    // 2. Add new monitors / update existing ones.
    for bm in backend_monitors.iter() {
        let existing_idx = monitors
            .iter()
            .position(|m| m.get("id").and_then(|v| v.as_str()) == Some(bm.id.as_str()));

        match existing_idx {
            None => {
                let bar = if bm.is_primary {
                    serde_json::json!([{ "id": gen_bar_widget_id(), "type": "clock" }])
                } else {
                    serde_json::json!([])
                };
                monitors.push(serde_json::json!({
                    "id": bm.id,
                    "name": bm.name,
                    "width": bm.width,
                    "height": bm.height,
                    "x": bm.x,
                    "y": bm.y,
                    "is_primary": bm.is_primary,
                    "scale_factor": bm.scale_factor,
                    "has_bar": bm.is_primary,
                    "has_widget_area": false,
                    "bar": bar,
                    "widgetArea": [],
                    "is_disconnected": false
                }));
                changed = true;
            }
            Some(idx) => {
                let m = &mut monitors[idx];

                let cw = m.get("width").and_then(|v| v.as_f64());
                let ch = m.get("height").and_then(|v| v.as_f64());
                let cx = m.get("x").and_then(|v| v.as_f64());
                let cy = m.get("y").and_then(|v| v.as_f64());
                let csf = m.get("scale_factor").and_then(|v| v.as_f64());
                if cw != Some(bm.width)
                    || ch != Some(bm.height)
                    || cx != Some(bm.x)
                    || cy != Some(bm.y)
                    || csf != Some(bm.scale_factor)
                {
                    m["width"] = serde_json::json!(bm.width);
                    m["height"] = serde_json::json!(bm.height);
                    m["x"] = serde_json::json!(bm.x);
                    m["y"] = serde_json::json!(bm.y);
                    m["scale_factor"] = serde_json::json!(bm.scale_factor);
                    changed = true;
                }

                let cur_primary = m
                    .get("is_primary")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if cur_primary != bm.is_primary {
                    m["is_primary"] = serde_json::json!(bm.is_primary);
                    // Demoted from primary → drop its auto-assigned bar.
                    if !bm.is_primary {
                        let has_bar = m.get("has_bar").and_then(|v| v.as_bool()).unwrap_or(false);
                        if has_bar {
                            m["has_bar"] = serde_json::json!(false);
                            m["bar"] = serde_json::json!([]);
                        }
                    }
                    changed = true;
                }

                // Ensure the primary monitor always has a bar.
                let has_bar_now = m.get("has_bar").and_then(|v| v.as_bool()).unwrap_or(false);
                if bm.is_primary && !has_bar_now {
                    m["has_bar"] = serde_json::json!(true);
                    m["bar"] = serde_json::json!([{ "id": gen_bar_widget_id(), "type": "clock" }]);
                    changed = true;
                }
            }
        }
    }

    parsed["monitors"] = serde_json::json!(monitors);

    if changed {
        let data = serde_json::to_string(&parsed).unwrap_or_else(|_| "{}".to_string());
        let _ = crate::database::save_layout(app.clone(), "default".to_string(), data).await;
    }

    let mut result = Vec::new();
    for m in monitors.iter() {
        if m.get("is_disconnected")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            continue;
        }
        let id = m
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        let has_bar = m.get("has_bar").and_then(|v| v.as_bool()).unwrap_or(false);
        let has_area = m
            .get("has_widget_area")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        result.push((id, has_bar, has_area));
    }
    result
}

/// Backend-driven startup. Reconciles the layout, creates every bar / widget
/// area, then waits for a dedicated readiness message from the frontend of
/// every created window. A window reports ready only after its stores hydrate,
/// all lazy widget components commit, and the rendered content gets two paint
/// frames. Only then are the background watchers started.
async fn startup_init(app: tauri::AppHandle) {
    let monitors_to_create = reconcile_layout_and_collect(&app).await;

    let mut bar_height: u32 = 36;
    if let Ok(settings_json) = crate::database::load_global_settings(app.clone()).await {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&settings_json) {
            if let Some(bh) = v.get("barHeight").and_then(|x| x.as_u64()) {
                bar_height = bh as u32;
            }
        }
    }

    // Register before building any windows so a very fast frontend cannot emit
    // readiness before the backend starts listening.
    let (loaded_tx, mut loaded_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let listener_id = app.listen("startup-window-loaded", move |event| {
        let label = serde_json::from_str::<serde_json::Value>(event.payload())
            .ok()
            .and_then(|payload| payload.get("label")?.as_str().map(str::to_owned));
        if let Some(label) = label {
            let _ = loaded_tx.send(label);
        }
    });

    let mut expected_labels = HashSet::new();

    for (monitor_id, has_bar, has_area) in monitors_to_create.iter() {
        if *has_bar {
            match crate::acrylic_layer::create_bar(app.clone(), monitor_id.clone(), bar_height).await {
                Ok(label) => {
                    expected_labels.insert(label);
                }
                Err(error) => {
                    eprintln!("[system] Failed to create bar for {monitor_id}: {error}");
                }
            }
        }
        if *has_area {
            match crate::acrylic_layer::create_widget_area(app.clone(), monitor_id.clone()).await {
                Ok(label) => {
                    expected_labels.insert(label);
                }
                Err(error) => {
                    eprintln!("[system] Failed to create widget area for {monitor_id}: {error}");
                }
            }
        }
    }

    println!(
        "[system] Waiting for {}/{} Bar/Area frontends to load...",
        0,
        expected_labels.len()
    );

    let mut loaded_labels = HashSet::new();
    while loaded_labels.len() < expected_labels.len() {
        let Some(label) = loaded_rx.recv().await else {
            app.unlisten(listener_id);
            eprintln!("[system] Frontend readiness channel closed; starting watchers anyway.");
            start_watchers_once(app.clone());
            return;
        };

        if expected_labels.contains(&label) && loaded_labels.insert(label.clone()) {
            println!(
                "[system] Frontend loaded: {label} ({}/{})",
                loaded_labels.len(),
                expected_labels.len()
            );
        }
    }

    app.unlisten(listener_id);
    println!("[system] All Bar/Area frontend content loaded.");
    start_watchers_once(app);
}



#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

#[tauri::command]
fn get_system_volume() -> Result<f32, String> {
    audio_control::get_volume()
}

#[tauri::command]
fn set_system_volume(vol: f32) -> Result<(), String> {
    audio_control::set_volume(vol)
}

#[tauri::command]
async fn proxy_request(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        _ => client.get(&url),
    };

    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    if let Some(b) = body {
        req = req.json(&b);
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    
    let status = res.status();
    if !status.is_success() {
        return Err(format!("HTTP Error {}: {}", status, res.text().await.unwrap_or_default()));
    }

    let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(val)
}

fn get_ai_abort_map() -> &'static Mutex<HashMap<String, tokio::task::AbortHandle>> {
    static MAP: std::sync::OnceLock<Mutex<HashMap<String, tokio::task::AbortHandle>>> = std::sync::OnceLock::new();
    MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
async fn stream_ai_request(
    window: tauri::Window,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<serde_json::Value>,
    event_id: String,
) -> Result<(), String> {
    let event_id_clone = event_id.clone();
    let window_clone = window.clone();

    let task = tokio::spawn(async move {
        let client = reqwest::Client::new();
        let mut req = match method.to_uppercase().as_str() {
            "POST" => client.post(&url),
            _ => client.get(&url),
        };

        for (k, v) in headers {
            req = req.header(&k, &v);
        }

        if let Some(b) = body {
            req = req.json(&b);
        }

        let mut res = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(e.to_string()),
        };

        let status = res.status();
        if !status.is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(format!("HTTP Error {}: {}", status, err_text));
        }

        let mut buffer = Vec::new();
        while let Ok(Some(chunk)) = res.chunk().await {
            buffer.extend_from_slice(&chunk);
            
            while let Some(i) = buffer.iter().position(|&b| b == b'\n') {
                let line_bytes = buffer.drain(..=i).collect::<Vec<u8>>();
                if let Ok(line_str) = String::from_utf8(line_bytes) {
                    let trimmed = line_str.trim();
                    if !trimmed.is_empty() {
                        let _ = window_clone.emit(&format!("ai-chunk-{}", event_id_clone), trimmed);
                    }
                }
            }
        }

        if !buffer.is_empty() {
            if let Ok(line_str) = String::from_utf8(buffer) {
                let trimmed = line_str.trim();
                if !trimmed.is_empty() {
                    let _ = window_clone.emit(&format!("ai-chunk-{}", event_id_clone), trimmed);
                }
            }
        }

        let _ = window_clone.emit(&format!("ai-close-{}", event_id_clone), "");
        Ok(())
    });

    let abort_handle = task.abort_handle();
    {
        let mut map = get_ai_abort_map().lock().unwrap();
        map.insert(event_id.clone(), abort_handle);
    }

    let res = task.await;

    {
        let mut map = get_ai_abort_map().lock().unwrap();
        map.remove(&event_id);
    }

    match res {
        Ok(inner_res) => inner_res,
        Err(_) => Ok(()),
    }
}

#[tauri::command]
async fn abort_ai_request(event_id: String) -> Result<bool, String> {
    let mut map = get_ai_abort_map().lock().unwrap();
    if let Some(abort_handle) = map.remove(&event_id) {
        abort_handle.abort();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn save_preset_dialog(default_name: String, content: String) -> Result<bool, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&default_name)
        .add_filter("JSON Preset", &["json"])
        .save_file()
        .await;

    if let Some(handle) = file {
        handle.write(content.as_bytes()).await.map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn open_preset_dialog() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("JSON Preset", &["json"])
        .pick_file()
        .await;

    if let Some(handle) = file {
        let bytes = handle.read().await;
        String::from_utf8(bytes).map_err(|e| e.to_string()).map(Some)
    } else {
        Ok(None)
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _new_instance_label| {
            // Re-launching the executable opens (or reveals) the main window.
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                crate::windows_pool::ensure_main_window(handle).await;
            });
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            request_popup,
            hide_popup,
            request_window,
            request_region,
            start_change_region,
            stop_change_region,
            remove_region,
            show_window,
            hide_window,
            open_main_window,
            acrylic_layer::init_monitors,
            acrylic_layer::get_layout,
            acrylic_layer::get_owner_window_label,
            acrylic_layer::create_bar,
            acrylic_layer::update_bar_height,
            acrylic_layer::remove_bar,
            create_widget_area,
            remove_widget_area,
            init_monitors,
            get_layout,
            load_all_layouts,
            save_layout,
            load_global_settings,
            save_global_settings,
            load_ai_instances,
            load_ai_sessions,
            load_ai_messages,
            save_ai_instance,
            save_ai_session,
            save_ai_message,
            delete_ai_instance,
            delete_ai_session,
            save_ai_draft,
            load_ai_drafts,
            delete_ai_draft,
            load_widget_instances,
            save_widget_instance_settings,
            delete_widget_instance,
            load_widget_registry,
            save_widget_registry,
            delete_widget_registry,
            exit_app,
            get_system_volume,
            set_system_volume,
            media_control::send_media_command,
            media_control::get_media_snapshot,
            load_clipboard_history,
            save_clipboard_history,
            clipboard_history::clipboard_paste_text,
            clipboard_history::clipboard_paste_formats,
            clipboard_history::clipboard_paste_files,
            clipboard_history::clipboard_paste_image,
            clipboard_history::clipboard_paste_figma,
            clipboard_history::clipboard_delete_image_files,
            clipboard_history::clipboard_save_text_payload,
            clipboard_history::clipboard_load_text_payload,
            set_window_no_activate,
            proxy_request,
            stream_ai_request,
            abort_ai_request,
            system_monitor::get_system_stats,
            save_attachment_file,
            read_attachment_file,
            save_preset_dialog,
            open_preset_dialog,
            clipboard_hook::enable_clipboard_keys,
            clipboard_hook::disable_clipboard_keys
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            clipboard_hook::init(handle.clone());
            fullscreen_detector::start_detector(handle.clone());
            let _ = init_monitors(handle.clone());
            init_reserved_windows(handle.clone());
            app.manage(SharedWidgetState::default());

            let stats = std::sync::Arc::new(std::sync::Mutex::new(system_monitor::SystemStats::default()));
            system_monitor::start_monitor_thread(stats.clone());
            app.manage(system_monitor::SystemMonitorState { stats });

            tauri::async_runtime::spawn(async move {
                startup_init(handle).await;
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
