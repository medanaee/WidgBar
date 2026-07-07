use std::sync::{atomic::AtomicUsize, Mutex};

use tauri::{App, AppHandle, Listener, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use window_vibrancy::{apply_acrylic, apply_blur};

use crate::windows_utils::{apply_persistent_acrylic, ease_out_cubic};

pub struct PoolWindow {
    label: String,
    is_busy: bool,
    close_on_blur: bool,
    is_dynamic: bool,
}
pub struct PoolState {
    windows: Mutex<Vec<PoolWindow>>,
}

static DYNAMIC_WIN_COUNTER: AtomicUsize = AtomicUsize::new(0);

const ANIMATION_DURATION:f64 = 150.0;
const ANIMATION_OFFSET: f64 = 5.0;
const ANIMATION_FPS: f64 = 60.0;

fn start_animation(start_y: f64, end_y: f64, x :f64, win_clone: tauri::WebviewWindow)
{
    tauri::async_runtime::spawn(async move {
        let steps = (ANIMATION_DURATION / (1000.0 / ANIMATION_FPS)) as i32;
        let sleep_time = std::time::Duration::from_millis((1000.0 / ANIMATION_FPS) as u64);

        for i in 0..=steps {
            let t = i as f64 / steps as f64;
            let eased_t = ease_out_cubic(t);
            let current_y = start_y - (ANIMATION_OFFSET * eased_t);
            let _ = win_clone.set_position(tauri::PhysicalPosition::new(
                x as i32,
                current_y as i32,
            ));
            tokio::time::sleep(sleep_time).await;
        }
        let _ = win_clone.set_position(tauri::PhysicalPosition::new(
            x as i32,
            end_y as i32,
        ));
    });
}

pub fn init_reserved_windows(app: AppHandle) {
    let num_window_reserved = 2;
    let mut pool_tracker = Vec::new();
    for i in 0..num_window_reserved {
        let label = format!("pool_win_{}", i);
        let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html#/blank".into()))
            .visible(false)
            .decorations(false)
            .always_on_top(false)
            .no_redirection_bitmap(true)
            .resizable(false)
            .skip_taskbar(true)
            .transparent(true)
            .shadow(true)
            .build()
            .expect("Failed to build pooled window");

        #[cfg(target_os = "windows")]
        {
            if let Ok(hwnd_val) = window.hwnd() {
                use crate::windows_utils::{apply_persistent_acrylic, set_window_theme};
                let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
                set_window_theme(hwnd, false);
                apply_persistent_acrylic(hwnd);
            }
        }

        window.on_window_event({
            let app_handle = app.clone();
            let label_clone = label.clone();
            move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let state = app_handle.state::<PoolState>();
                    let mut pool = state.windows.lock().unwrap();

                    if let Some(win) = pool.iter_mut().find(|w| w.label == label_clone) {
                        if win.is_busy && win.close_on_blur {
                            if let Some(w) = app_handle.get_webview_window(&label_clone) {
                                w.hide().ok();
                            }
                            win.is_busy = false;
                            println!("Window {} teleported off-screen due to blur", label_clone);
                        }
                    }
                }
            }
        });

        pool_tracker.push(PoolWindow {
            label,
            is_busy: false,
            close_on_blur: false,
            is_dynamic: false,
        });
    }

    app.manage(PoolState {
        windows: Mutex::new(pool_tracker),
    });
}

pub async fn init_main_window(app: AppHandle) {
    let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(1);
    // 1. Creating the window using WebviewWindowBuilder with the requested configurations
    let window = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
        .title("Main Window")
        .inner_size(1200.0, 800.0)
        .min_inner_size(1000.0, 400.0)
        .visible(false)
        .decorations(false)
        .transparent(true)
        .no_redirection_bitmap(true)
        .center()
        // .drag_and_drop(true)
        .build()
        .expect("Failed to build Main window");


    let js_command = "window.dispatchEvent(new CustomEvent('rust-navigation', {{ detail: {{ route: '/' }} }}));";
    let _ = window.eval(js_command);

    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd_val) = window.hwnd() {
            use crate::windows_utils::{set_os_window_animation, set_window_theme};
            let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
            set_window_theme(hwnd, false);
            apply_persistent_acrylic(hwnd);
            // set_os_window_animation(hwnd, false);
        }
    }

    // apply_blur(window.clone(), Some((0,0,0,0))).expect("ssssss");
    // apply_acrylic(window.clone(), Some((0,0,0,0)));

    window.once("show_ready", move |_event| {
        let _ = tx.try_send(());
        println!("Received show_ready from frontend.");
    });

    let _ = tokio::time::timeout(std::time::Duration::from_millis(1000), rx.recv()).await;

    show_window_(window.clone());
    window.set_focus().ok();


}

pub fn show_window_(window: WebviewWindow) {
    let position = window.outer_position().map_err(|e| e.to_string()).expect("Err to get position");
        let x = position.x as f64;
        let start_y = position.y as f64 + ANIMATION_OFFSET;
        let end_y = position.y as f64;
        window.set_position(tauri::PhysicalPosition::new(x, start_y));
        window.show();
        start_animation(start_y, end_y, x, window.clone());
}

#[tauri::command]
pub async fn show_window(app_handle: AppHandle, label: String) {
    println!("fbf");
    if let Some(window) = app_handle.get_webview_window(&label) {
        show_window_(window)
    }
}

#[tauri::command]
pub async fn hide_window(window: WebviewWindow) {
    window.hide();
}

#[tauri::command]
pub async fn request_popup(
    app: tauri::AppHandle,
    state: tauri::State<'_, PoolState>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    route: String,
    close_on_blur: bool,
    x_is_center: bool,
    animated: bool,
    below_bar: bool,
    center: bool,
    resizable: Option<bool>,
    skip_taskbar: Option<bool>,
    always_on_top: Option<bool>,
) -> Result<String, String> {
    let resizable = resizable.unwrap_or(false);
    let skip_taskbar = skip_taskbar.unwrap_or(true);
    let always_on_top = always_on_top.unwrap_or(false);

    println!(
        "Popup requested at ({}, {}) with size {}x{}, route: {}, close_on_blur: {}, x_is_center: {}, animated: {}, below_bar: {}, center: {}, resizable: {}, skip_taskbar: {}, always_on_top: {}",
        x, y, width, height, route, close_on_blur, x_is_center, animated, below_bar, center, resizable, skip_taskbar, always_on_top
    );
    let mut selected_label = None;
    let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(1);

    {
        let mut pool = state.windows.lock().unwrap();
        for win in pool.iter_mut() {
            if !win.is_busy {
                win.is_busy = true;
                win.close_on_blur = close_on_blur;
                selected_label = Some(win.label.clone());
                break;
            }
        }
    }

    let label = match selected_label {
        Some(l) => {
            println!("Reusing window from pool: {}", l);
            l
        }
        None => {
            println!("No available windows in pool! Creating a dynamic one.");
            let new_id = DYNAMIC_WIN_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            let new_label = format!("pool_win_dynamic_{}", new_id);

            let initial_url = format!("index.html#{}", route);
            let new_window = tauri::WebviewWindowBuilder::new(&app, &new_label, tauri::WebviewUrl::App(initial_url.into()))
                .visible(false)
                .decorations(false)
                .always_on_top(false)
                .no_redirection_bitmap(true)
                .resizable(false)
                .skip_taskbar(true)
                .transparent(true)
                .shadow(true)
                .build()
                .expect("Failed to build dynamic window");

            #[cfg(target_os = "windows")]
            {
                if let Ok(hwnd_val) = new_window.hwnd() {
                    use crate::windows_utils::{apply_persistent_acrylic, set_window_theme};
                    let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
                    set_window_theme(hwnd, false);
                    apply_persistent_acrylic(hwnd);
                }
            }

            new_window.on_window_event({
                let app_handle = app.clone();
                let label_clone = new_label.clone();
                move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let state = app_handle.state::<PoolState>();
                        let mut pool = state.windows.lock().unwrap();
                        let mut remove_idx = None;
                        for (i, win) in pool.iter_mut().enumerate() {
                            if win.label == label_clone {
                                if win.is_busy && win.close_on_blur {
                                    if let Some(w) = app_handle.get_webview_window(&label_clone) {
                                        if win.is_dynamic {
                                            let _ = w.close();
                                            remove_idx = Some(i);
                                        } else {
                                            let _ = w.hide();
                                            win.is_busy = false;
                                        }
                                    }
                                }
                                break;
                            }
                        }
                        if let Some(idx) = remove_idx {
                            pool.remove(idx);
                        }
                    }
                }
            });

            {
                let mut pool = state.windows.lock().unwrap();
                pool.push(PoolWindow {
                    label: new_label.clone(),
                    is_busy: true,
                    close_on_blur,
                    is_dynamic: true,
                });
            }
            
            new_label
        }
    };

    let window = app.get_webview_window(&label).unwrap();
    let win_clone = window.clone();

    let scale_factor = window.current_monitor().ok().flatten().map(|m| m.scale_factor()).unwrap_or(1.0);

    let (final_x, target_y) = if center {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let pos = monitor.position();
            let size = monitor.size();
            let cx = (pos.x as f64) + (size.width as f64 / 2.0);
            let cy = (pos.y as f64) + (size.height as f64 / 2.0);
            (cx - (width / 2.0), cy - (height / 2.0))
        } else {
            (x, y)
        }
    } else if below_bar {
        let mut bar_height_logical = 36.0;
        if let Ok(settings_json) = crate::database::load_global_settings(app.clone()).await {
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&settings_json) {
                if let Some(bh) = settings.get("barHeight").and_then(|v| v.as_f64()) {
                    bar_height_logical = bh;
                }
            }
        }
        let final_y = (bar_height_logical + 12.0) * scale_factor;
        let fx = if x_is_center { x - (width / 2.0) } else { x };
        (fx, final_y)
    } else {
        let final_y = if y == 0.0 { 36.0 + 12.0 } else { y };
        let fx = if x_is_center { x - (width / 2.0) } else { x };
        (fx, final_y)
    };

    let offset = 5.0;
    let start_y = target_y + offset;

    let _ = window.set_resizable(resizable);
    let _ = window.set_skip_taskbar(skip_taskbar);
    let _ = window.set_always_on_top(always_on_top);
    let _ = window.set_size(tauri::PhysicalSize::new(width as u32, height as u32));

    let js_command = format!(
    "window.dispatchEvent(new CustomEvent('rust-navigation', {{ detail: {{ route: '{}' }} }}));", 
    route
    );
    let _ = window.eval(&js_command);

    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd_val) = window.hwnd() {
            use crate::windows_utils::{set_os_window_animation, set_window_theme};

            let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
            set_os_window_animation(hwnd, false);
            set_window_theme(hwnd, false);
        }
    }

    window.once("show_ready", move |_event| {
        let _ = tx.try_send(());
        println!("Received show_ready from frontend.");
    });

    let _ = tokio::time::timeout(std::time::Duration::from_millis(1000), rx.recv()).await;

    if animated {
        let _ = window.set_position(tauri::PhysicalPosition::new(final_x as i32, start_y as i32));
    } else {
        let _ = window.set_position(tauri::PhysicalPosition::new(
            final_x as i32,
            target_y as i32,
        ));
    }
    window.show().ok();
    window.set_focus().ok();

    if !animated {
        return Ok(label);
    }
    tauri::async_runtime::spawn(async move {
        let duration_ms = 180.0;
        let fps = 60.0;
        let steps = (duration_ms / (1000.0 / fps)) as i32;
        let sleep_time = std::time::Duration::from_millis((1000.0 / fps) as u64);

        for i in 0..=steps {
            let t = i as f64 / steps as f64;
            let eased_t = ease_out_cubic(t);
            let current_y = start_y - (offset * eased_t);
            let _ = win_clone.set_position(tauri::PhysicalPosition::new(
                final_x as i32,
                current_y as i32,
            ));
            tokio::time::sleep(sleep_time).await;
        }
        let _ = win_clone.set_position(tauri::PhysicalPosition::new(
            final_x as i32,
            target_y as i32,
        ));
    });

    Ok(label)
}

#[tauri::command]
pub async fn hide_popup(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, PoolState>,
    label: Option<String>,
    self_close: bool,
) -> Result<(), String> {
    let target_label = if self_close {
        window.label().to_string()
    } else if let Some(l) = label {
        l
    } else {
        return Err("Must provide a label or set self_close to true".into());
    };

    let mut pool = state.windows.lock().unwrap();
    let mut remove_idx = None;

    for (i, win) in pool.iter_mut().enumerate() {
        if win.label == target_label {
            if win.is_dynamic {
                remove_idx = Some(i);
            } else {
                win.is_busy = false;
                if let Some(w) = app.get_webview_window(&target_label) {
                    w.hide().ok();
                }
            }
            break;
        }
    }

    if let Some(idx) = remove_idx {
        pool.remove(idx);
        if let Some(w) = app.get_webview_window(&target_label) {
            w.close().ok();
        }
    }

    Ok(())
}
