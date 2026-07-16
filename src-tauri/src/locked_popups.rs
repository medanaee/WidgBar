use std::sync::atomic::AtomicUsize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter, Url};

pub struct LockedPopupsState {
    pub windows: Mutex<Vec<String>>,
}

static LOCKED_WIN_COUNTER: AtomicUsize = AtomicUsize::new(0);

#[tauri::command]
pub async fn create_locked_popup(
    app: AppHandle,
    id: String,
    url: String,
) -> Result<String, String> {
    let label = format!("locked_popup_{}", id);
    
    // Check if it already exists
    if let Some(_) = app.get_webview_window(&label) {
        return Ok(label);
    }
    
    let js_init = r#"
        window.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = `
                #widgbar-bubble-container {
                    position: fixed;
                    top: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 12px;
                    height: 12px;
                    border-radius: 20px;
                    background: rgba(100, 100, 100, 0.5);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    z-index: 2147483647;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    -webkit-app-region: drag;
                }
                #widgbar-bubble-container:hover {
                    width: 180px;
                    height: 36px;
                    background: rgba(20, 20, 20, 0.85);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                #widgbar-btn-wrapper {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 0 12px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    pointer-events: none;
                }
                #widgbar-bubble-container:hover #widgbar-btn-wrapper {
                    opacity: 1;
                    pointer-events: auto;
                    transition-delay: 0.15s;
                }
                .widgbar-btn {
                    -webkit-app-region: no-drag;
                    border: none;
                    border-radius: 6px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: bold;
                    font-family: 'Google Sans', 'Segoe UI', Roboto, sans-serif;
                }
                .widgbar-btn:hover {
                    filter: brightness(1.2);
                }
                #widgbar-hide-btn {
                    background: rgba(255,255,255,0.1);
                    color: white;
                    margin-right: 6px;
                }
                #widgbar-close-btn {
                    background: rgba(255, 77, 79, 0.2);
                    color: #ff4d4f;
                }
                #widgbar-title {
                    flex: 1;
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                    font-family: 'Google Sans', 'Segoe UI', Roboto, sans-serif;
                    user-select: none;
                }
            `;
            document.head.appendChild(style);

            const container = document.createElement('div');
            container.id = 'widgbar-bubble-container';
            
            const btnWrapper = document.createElement('div');
            btnWrapper.id = 'widgbar-btn-wrapper';
            
            const title = document.createElement('div');
            title.id = 'widgbar-title';
            title.textContent = 'Drag Me';
            btnWrapper.appendChild(title);
            
            const hideBtn = document.createElement('button');
            hideBtn.id = 'widgbar-hide-btn';
            hideBtn.className = 'widgbar-btn';
            hideBtn.textContent = 'Hide';
            hideBtn.onclick = () => { window.location.href = 'http://widgbar.local/action/hide'; };
            btnWrapper.appendChild(hideBtn);
            
            const closeBtn = document.createElement('button');
            closeBtn.id = 'widgbar-close-btn';
            closeBtn.className = 'widgbar-btn';
            closeBtn.textContent = 'Close';
            closeBtn.onclick = () => { window.location.href = 'http://widgbar.local/action/close'; };
            btnWrapper.appendChild(closeBtn);
            
            container.appendChild(btnWrapper);
            document.body.appendChild(container);
        });
    "#;

    let app_handle_clone = app.clone();
    let lbl = label.clone();
    
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url.parse().unwrap()))
        .visible(false)
        .decorations(false) // Custom bubble titlebar
        .always_on_top(true)
        .initialization_script(js_init)
        .on_navigation({
            let app_handle_clone = app_handle_clone.clone();
            let lbl = lbl.clone();
            move |url| {
                let url_str = url.as_str();
                if url_str.starts_with("http://widgbar.local/action/hide") {
                    if let Some(w) = app_handle_clone.get_webview_window(&lbl) {
                        let _ = w.hide();
                    }
                    false
                } else if url_str.starts_with("http://widgbar.local/action/close") {
                    if let Some(w) = app_handle_clone.get_webview_window(&lbl) {
                        let _ = w.close();
                        // Remove from state
                        let state = app_handle_clone.state::<LockedPopupsState>();
                        state.windows.lock().unwrap().retain(|l| l != &lbl);
                    }
                    false
                } else if url_str.starts_with("http://widgbar.local/ai-res/") {
                    if let Some(payload) = url_str.strip_prefix("http://widgbar.local/ai-res/") {
                        if let Some(main_win) = app_handle_clone.get_webview_window("main") {
                            let _ = main_win.emit("ai-response-received", payload);
                        }
                    }
                    false
                } else {
                    true
                }
            }
        })
        .build()
        .map_err(|e| e.to_string())?;

    let state = app.state::<LockedPopupsState>();
    state.windows.lock().unwrap().push(label.clone());

    Ok(label)
}

#[tauri::command]
pub async fn show_locked_popup(
    app: AppHandle,
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = format!("locked_popup_{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.set_size(tauri::PhysicalSize::new(width as u32, height as u32));
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("Window not found".into())
    }
}

#[tauri::command]
pub async fn hide_locked_popup(app: AppHandle, id: String) -> Result<(), String> {
    let label = format!("locked_popup_{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Window not found".into())
    }
}

#[tauri::command]
pub async fn close_locked_popup(app: AppHandle, id: String) -> Result<(), String> {
    let label = format!("locked_popup_{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
        
        let state = app.state::<LockedPopupsState>();
        state.windows.lock().unwrap().retain(|l| l != &label);
        
        Ok(())
    } else {
        Err("Window not found".into())
    }
}

#[tauri::command]
pub async fn execute_js_in_popup(app: AppHandle, id: String, script: String) -> Result<(), String> {
    let label = format!("locked_popup_{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        window.eval(&script).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Window not found".into())
    }
}
