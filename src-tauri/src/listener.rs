use std::sync::OnceLock;
use std::thread;
use tauri::{AppHandle, Emitter};
use windows::core::Interface;
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, IServiceProvider, CLSCTX_ALL};
use windows::Win32::System::Variant::VARIANT;
use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
use windows::Win32::UI::Shell::{
    IFolderView, IShellBrowser, IShellItemArray, IShellWindows, IWebBrowserApp, ShellWindows,
    CSIDL_DESKTOP, SIGDN_FILESYSPATH, SVGIO_SELECTION, SWC_DESKTOP, SWFO_NEEDDISPATCH,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, GetAncestor, GetMessageW, TranslateMessage, EVENT_OBJECT_SELECTION,
    EVENT_OBJECT_SELECTIONADD, EVENT_OBJECT_SELECTIONREMOVE, EVENT_OBJECT_SELECTIONWITHIN, GA_ROOT,
    MSG, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

// ۱. تابع هوک سیستم برای دریافت ایونت‌های انتخاب فایل
unsafe extern "system" fn win_event_proc(
    _h_win_event_hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    if event >= EVENT_OBJECT_SELECTION && event <= EVENT_OBJECT_SELECTIONWITHIN {
        let paths = get_paths_from_shell(hwnd);

        if let Some(app) = APP_HANDLE.get() {
            if !paths.is_empty() {
                // println!("[DEBUG] Emitting to frontend: {:?}", paths);
                let _ = app.emit("file-selection-changed", paths);
            } else {
                // println!("[DEBUG] Selection cleared. Emitting empty array.");
                let empty_paths: Vec<String> = Vec::new();
                let _ = app.emit("file-selection-changed", empty_paths);
            }
        }
    }
}

// ۲. تابع استخراج مسیرها از آبجکت COM
unsafe fn extract_paths(web_browser_app: &IWebBrowserApp) -> Option<Vec<String>> {
    println!("Nigga");
    let service_provider: IServiceProvider = web_browser_app.cast().ok()?;
    let shell_browser: IShellBrowser = service_provider
        .QueryService::<IShellBrowser>(&IShellBrowser::IID)
        .ok()?;
    let shell_view = shell_browser.QueryActiveShellView().ok()?;
    let folder_view: IFolderView = shell_view.cast().ok()?;
    let item_array: IShellItemArray = folder_view.Items(SVGIO_SELECTION).ok()?;

    let item_count = item_array.GetCount().unwrap_or(0);
    if item_count == 0 {
        return None;
    }

    let mut paths = Vec::new();
    for i in 0..item_count {
        if let Ok(item) = item_array.GetItemAt(i) {
            if let Ok(display_name) = item.GetDisplayName(SIGDN_FILESYSPATH) {
                let path = display_name.to_string().unwrap_or_default();
                CoTaskMemFree(Some(display_name.as_ptr() as _));
                paths.push(path);
            }
        }
    }
    Some(paths)
}

// ۳. تابع اصلی برای پیدا کردن پنجره (فولدر یا دسکتاپ) و پاس دادن به extract_paths
pub fn get_paths_from_shell(target_hwnd: HWND) -> Vec<String> {
    let mut selected_paths = Vec::new();
    unsafe {
        let root_hwnd = GetAncestor(target_hwnd, GA_ROOT);

        let shell_windows: IShellWindows = match CoCreateInstance(&ShellWindows, None, CLSCTX_ALL) {
            Ok(sw) => sw,
            Err(_) => return selected_paths,
        };

        let count = shell_windows.Count().unwrap_or(0);
        for i in 0..count {
            if let Ok(dispatch) = shell_windows.Item(&VARIANT::from(i)) {
                if let Ok(web_browser_app) = dispatch.cast::<IWebBrowserApp>() {
                    if let Ok(current_hwnd_val) = web_browser_app.HWND() {
                        let current_hwnd = HWND(current_hwnd_val.0 as _);
                        if current_hwnd == target_hwnd || current_hwnd == root_hwnd {
                            if let Some(paths) = extract_paths(&web_browser_app) {
                                return paths;
                            }
                        }
                    }
                }
            }
        }

        // بخش دسکتاپ (بدون کست‌های غیرضروری i32)
        let mut d_hwnd_val: i32 = 0;
        if let Ok(desktop_dispatch) = shell_windows.FindWindowSW(
            &VARIANT::from(CSIDL_DESKTOP as i32),
            &VARIANT::default(),
            SWC_DESKTOP,
            &mut d_hwnd_val,
            SWFO_NEEDDISPATCH,
        ) {
            let d_hwnd = HWND(d_hwnd_val as _);
            if let Ok(web_browser_app) = desktop_dispatch.cast::<IWebBrowserApp>() {
                let b_hwnd = match web_browser_app.HWND() {
                    Ok(h) => HWND(h.0 as _),
                    Err(_) => HWND(std::ptr::null_mut()), // استفاده از پوینتر نال استاندارد
                };

                if target_hwnd == d_hwnd
                    || root_hwnd == d_hwnd
                    || target_hwnd == b_hwnd
                    || root_hwnd == b_hwnd
                {
                    if let Some(paths) = extract_paths(&web_browser_app) {
                        return paths;
                    }
                }
            }
        }
    }
    selected_paths
}

// ۴. راه‌انداز لیسنر بک‌گراند (فراخوانی در main.rs)
pub fn init_selection_listener(app: AppHandle) {
    if APP_HANDLE.set(app).is_err() {
        return;
    }

    thread::spawn(|| unsafe {
        let hook = SetWinEventHook(
            EVENT_OBJECT_SELECTION,
            EVENT_OBJECT_SELECTIONWITHIN,
            None,
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
        if hook.is_invalid() {
            println!("[ERROR] Failed to set Windows Event Hook.");
            return;
        }

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).into() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });
}
