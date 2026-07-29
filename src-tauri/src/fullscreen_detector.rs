use tauri::{AppHandle, Manager};
use std::time::Duration;
use tokio::time::sleep;
use windows::Win32::Foundation::RECT;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowRect, GetDesktopWindow, GetShellWindow,
    SetWindowPos, SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE
};
use windows::Win32::Graphics::Gdi::{
    MonitorFromWindow, GetMonitorInfoW, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use std::collections::HashMap;

pub fn start_detector(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Tracks whether a bar is currently demoted (always_on_top = false)
        // Key: window label, Value: is_demoted
        let mut bar_states: HashMap<String, bool> = HashMap::new();

        loop {
            sleep(Duration::from_millis(200)).await;

            let mut fs_info = None;

            unsafe {
                let hwnd = GetForegroundWindow();
                if !hwnd.0.is_null() && hwnd != GetDesktopWindow() && hwnd != GetShellWindow() {
                    let mut rect: RECT = std::mem::zeroed();
                    if GetWindowRect(hwnd, &mut rect).is_ok() {
                        let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                        if !hmonitor.is_invalid() {
                            let mut mi = MONITORINFO {
                                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                                ..std::mem::zeroed()
                            };
                            if GetMonitorInfoW(hmonitor, &mut mi).as_bool() {
                                let mon_rect = mi.rcMonitor;
                                
                                // Check if the window covers the entire monitor
                                if rect.left <= mon_rect.left
                                    && rect.top <= mon_rect.top
                                    && rect.right >= mon_rect.right
                                    && rect.bottom >= mon_rect.bottom
                                {
                                    fs_info = Some((mon_rect, hwnd));
                                }
                            }
                        }
                    }
                }
            }

            let windows = app.webview_windows();
            for (label, window) in windows {
                if label.starts_with("bar_") {
                    let mut should_demote = false;
                    let mut target_fs_hwnd = None;

                    if let Some((mon_rect, fs_hwnd)) = fs_info {
                        if let Ok(Some(monitor)) = window.current_monitor() {
                            let pos = monitor.position();
                            let size = monitor.size();
                            
                            let t_left = pos.x;
                            let t_top = pos.y;
                            let t_right = pos.x + size.width as i32;
                            let t_bottom = pos.y + size.height as i32;

                            // If this bar is on the monitor with the fullscreen app
                            if mon_rect.left == t_left
                                && mon_rect.top == t_top
                                && mon_rect.right == t_right
                                && mon_rect.bottom == t_bottom
                            {
                                should_demote = true;
                                target_fs_hwnd = Some(fs_hwnd);
                            }
                        }
                    }

                    let currently_demoted = *bar_states.get(&label).unwrap_or(&false);
                    
                    if should_demote && !currently_demoted {
                        // Fullscreen app active on this monitor -> remove always_on_top
                        let _ = window.set_always_on_top(false);
                        
                        // Push Bar immediately behind the fullscreen window in Z-order
                        if let Ok(hwnd_val) = window.hwnd() {
                            if let Some(fs_hwnd) = target_fs_hwnd {
                                unsafe {
                                    let bar_hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
                                    let _ = SetWindowPos(
                                        bar_hwnd,
                                        Some(fs_hwnd),
                                        0, 0, 0, 0,
                                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                                    );
                                }
                            }
                        }

                        bar_states.insert(label.clone(), true);
                    } else if !should_demote && currently_demoted {
                        // Fullscreen app gone -> restore always_on_top
                        let _ = window.set_always_on_top(true);
                        bar_states.insert(label.clone(), false);
                    }
                }
            }
        }
    });
}
