#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use once_cell::sync::OnceCell;
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Listener;
use tauri::Manager;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use window_vibrancy::*;

mod windows_utils;
use windows_utils::*;
mod listener;

mod acrylic_layer;
use acrylic_layer::*;

use std::collections::HashMap;
use tauri::State;

mod windows_pool;
use crate::windows_pool::*;

mod database;
use crate::database::*;

mod locked_popups;
use crate::locked_popups::*;

static WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(0);




#[tauri::command]
async fn request_window(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    route: String,
    animated: bool,
    always_on_top: bool,
) -> Result<String, String> {
    let count = WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    let label = format!("dynamic_win_{}", count);

    let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(1);

    let builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html/#{}", route).into()),
    )
    .inner_size(width, height)
    .resizable(true)
    .skip_taskbar(false)
    .always_on_top(always_on_top)
    .transparent(true)
    // .no_redirection_bitmap(true)
    // .decorations(false)
    .visible(false); 

    let window = builder.build().map_err(|e| e.to_string())?;
    let win_clone = window.clone();

    let tx_shared = Arc::new(Mutex::new(Some(tx)));

    window.listen("show_ready", move |_event| {
        let mut tx_lock = tx_shared.lock().unwrap();
        if let Some(sender) = tx_lock.take() {
            let _ = sender.try_send(());
            println!("Received show_ready from frontend. Handled exactly once.");
        } else {
            println!("show_ready event received again, safely ignored.");
        }
    });

    #[cfg(target_os = "windows")]
    {
        apply_acrylic(&window, Some((200, 200, 200, 200)));
        apply_mica(&window, None);
        if let Ok(hwnd_val) = window.hwnd() {
            let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
            // apply_persistent_acrylic(hwnd);
            set_os_window_animation(hwnd, animated);
        }
        
    }

    let target_y = y;
    let offset = 10.0;
    let start_y = target_y + offset;
    let final_x = x;


    let _ = tokio::time::timeout(std::time::Duration::from_millis(3000), rx.recv()).await;

    // if animated {
    //     let _ = window.set_position(tauri::PhysicalPosition::new(final_x as i32, start_y as i32));
    // } else {
    //     let _ = window.set_position(tauri::PhysicalPosition::new(
    //         final_x as i32,
    //         target_y as i32,
    //     ));
    // }
    let _ = window.set_position(tauri::PhysicalPosition::new(
        final_x as i32,
        target_y as i32,
    ));

    window.show().ok();
    window.set_focus().ok();

    // if !animated {
    //     return Ok(label);
    // }

    // tauri::async_runtime::spawn(async move {
    //     let duration_ms = 180.0;
    //     let fps = 60.0;
    //     let steps = (duration_ms / (1000.0 / fps)) as i32;
    //     let sleep_time = std::time::Duration::from_millis((1000.0 / fps) as u64);

    //     for i in 0..=steps {
    //         let t = i as f64 / steps as f64;
    //         let eased_t = ease_out_cubic(t);
    //         let current_y = start_y - (offset * eased_t);

    //         let _ = win_clone.set_position(tauri::PhysicalPosition::new(
    //             final_x as i32,
    //             current_y as i32,
    //         ));
    //         tokio::time::sleep(sleep_time).await;
    //     }

    //     let _ = win_clone.set_position(tauri::PhysicalPosition::new(
    //         final_x as i32,
    //         target_y as i32,
    //     ));
    // });

    Ok(label)
}





#[tauri::command]
fn exit_app() {
    std::process::exit(0);
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

fn main() {
    tauri::Builder::default()
        .manage(LockedPopupsState {
            windows: Mutex::new(Vec::new()),
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _new_instance_label| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.unminimize();
                let _ = main_window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
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
            acrylic_layer::init_monitors,
            acrylic_layer::get_layout,
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
            load_ai_data,
            save_ai_data,
            load_widget_instances,
            save_widget_instance_settings,
            delete_widget_instance,
            create_locked_popup,
            show_locked_popup,
            hide_locked_popup,
            close_locked_popup,
            execute_js_in_popup,
            exit_app,
            proxy_request
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = init_monitors(handle.clone());
            init_reserved_windows(handle.clone());
            tauri::async_runtime::block_on(async move {
                init_main_window(handle).await;
            });
            app.manage(SharedWidgetState::default());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
