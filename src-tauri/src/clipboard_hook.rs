use tauri::{AppHandle, Emitter};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use windows::Win32::Foundation::{LRESULT, WPARAM, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx,
    WH_KEYBOARD_LL, HHOOK, KBDLLHOOKSTRUCT, HC_ACTION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{VK_UP, VK_DOWN, VK_RETURN, VK_ESCAPE};

struct HookWrapper(HHOOK);
unsafe impl Send for HookWrapper {}
unsafe impl Sync for HookWrapper {}

static HOOK_HANDLE: Mutex<Option<HookWrapper>> = Mutex::new(None);
static APP_HANDLE: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

pub fn init(app: AppHandle) {
    let _ = APP_HANDLE.set(app);
}

unsafe extern "system" fn hook_callback(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code == HC_ACTION as i32 {
        let wm_keydown = 0x0100; // WM_KEYDOWN
        let wm_syskeydown = 0x0104; // WM_SYSKEYDOWN
        
        if w_param.0 as u32 == wm_keydown || w_param.0 as u32 == wm_syskeydown {
            let kb_struct = *(l_param.0 as *const KBDLLHOOKSTRUCT);
            let vk = kb_struct.vkCode as u16;
            
            let key_str = if vk == VK_UP.0 {
                Some("Up")
            } else if vk == VK_DOWN.0 {
                Some("Down")
            } else if vk == VK_RETURN.0 {
                Some("Enter")
            } else if vk == VK_ESCAPE.0 {
                Some("Escape")
            } else {
                None
            };
            
            if let Some(k) = key_str {
                println!("[clipboard_hook] Intercepted key: {}", k);
                if let Some(app) = APP_HANDLE.get() {
                    let _ = app.emit("clipboard-key", k);
                }
                return LRESULT(1);
            }
        }
    }
    CallNextHookEx(None, n_code, w_param, l_param)
}

#[tauri::command]
pub fn enable_clipboard_keys() {
    println!("[clipboard_hook] enable_clipboard_keys called");
    if let Some(app) = APP_HANDLE.get() {
        let _ = app.run_on_main_thread(move || {
            let mut handle = HOOK_HANDLE.lock().unwrap();
            if handle.is_none() {
                unsafe {
                    let hook = SetWindowsHookExW(
                        WH_KEYBOARD_LL,
                        Some(hook_callback),
                        None,
                        0,
                    );
                    if let Ok(h) = hook {
                        println!("[clipboard_hook] Hook successfully installed");
                        *handle = Some(HookWrapper(h));
                    } else {
                        println!("[clipboard_hook] Failed to install hook");
                    }
                }
            } else {
                println!("[clipboard_hook] Hook is already active");
            }
        });
    } else {
        println!("[clipboard_hook] APP_HANDLE is not initialized");
    }
}

#[tauri::command]
pub fn disable_clipboard_keys() {
    println!("[clipboard_hook] disable_clipboard_keys called");
    if let Some(app) = APP_HANDLE.get() {
        let _ = app.run_on_main_thread(move || {
            let mut handle = HOOK_HANDLE.lock().unwrap();
            if let Some(wrapper) = handle.take() {
                unsafe {
                    let _ = UnhookWindowsHookEx(wrapper.0);
                    println!("[clipboard_hook] Hook uninstalled");
                }
            } else {
                println!("[clipboard_hook] Hook was not active");
            }
        });
    }
}
