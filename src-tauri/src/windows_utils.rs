#[cfg(target_os = "windows")]
use std::ffi::c_void;

use tauri::WebviewWindow;

use windows::core::{s, w, BOOL, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_EXCLUDED_FROM_PEEK, DWMWA_TRANSITIONS_FORCEDISABLED,
    DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
    DWMWCP_ROUNDSMALL,
};
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};
use windows::Win32::UI::Shell::{
    SHAppBarMessage, ABE_TOP, ABM_NEW, ABM_QUERYPOS, ABM_SETPOS, APPBARDATA,
};
use windows::Win32::UI::WindowsAndMessaging::{
    AW_BLEND, AW_HIDE, AnimateWindow, EnumWindows, FindWindowExW, FindWindowW, GWL_EXSTYLE, GetWindowLongPtrW, GetWindowLongW, HWND_BOTTOM, LWA_ALPHA, SMTO_NORMAL, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SendMessageTimeoutW, SetLayeredWindowAttributes, SetParent, SetWindowLongPtrW, SetWindowLongW, SetWindowPos, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT
};

#[cfg(target_os = "windows")]
#[repr(C)]
struct AccentPolicy {
    accent_state: u32,
    accent_flags: u32,
    gradient_color: u32,
    animation_id: u32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct WindowCompositionAttributeData {
    attribute: u32,
    data: *mut std::ffi::c_void,
    size_of_data: usize,
}

#[cfg(target_os = "windows")]
pub fn apply_persistent_acrylic(hwnd: HWND) {
    const WCA_ACCENT_POLICY: u32 = 19;
    const ACCENT_ENABLE_ACRYLICBLURBEHIND: u32 = 4; // کد مربوط به اکریلیک


let mut policy = AccentPolicy {
    accent_state: ACCENT_ENABLE_ACRYLICBLURBEHIND,
    accent_flags: 0x20, // 0x20 فلگ رسمی برای فعال کردن gradient_color است
    gradient_color: 0x01FFFFFF, // آلفا = 01 (تقریبا صفر)، رنگ = سفید خالص
    animation_id: 0,
};

    let mut data = WindowCompositionAttributeData {
        attribute: WCA_ACCENT_POLICY,
        data: &mut policy as *mut _ as *mut std::ffi::c_void,
        size_of_data: std::mem::size_of::<AccentPolicy>(),
    };

    // لود کردن تابع مخفی از user32.dll
    unsafe {
        let user32 = LoadLibraryA(s!("user32.dll")).unwrap();
        if let Some(func) = GetProcAddress(user32, s!("SetWindowCompositionAttribute")) {
            let set_window_composition_attribute: unsafe extern "system" fn(
                HWND,
                *mut WindowCompositionAttributeData,
            ) -> windows::Win32::Foundation::VARIANT_BOOL = std::mem::transmute(func);

            set_window_composition_attribute(hwnd, &mut data);
        }
    }
}


pub fn ease_out_cubic(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

#[cfg(target_os = "windows")]
pub fn set_window_alpha(hwnd: HWND, opacity: f64) {
    let alpha = (opacity.clamp(0.0, 1.0) * 255.0) as u8;

    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

        if (ex_style & WS_EX_LAYERED.0 as isize) == 0 {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED.0 as isize);
        }

        SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA);
    }
}

#[cfg(target_os = "windows")]
pub fn set_os_window_animation(hwnd: HWND, enable_animation: bool) {
    let disable_val: i32 = if enable_animation { 0 } else { 1 };

    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &disable_val as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }
}


#[cfg(target_os = "windows")]
pub fn set_window_theme(hwnd: HWND, is_dark: bool) -> () {

    let theme_value = if is_dark { 1i32 } else { 0i32 };

    unsafe {
        // DWMWA_USE_IMMERSIVE_DARK_MODE is typically 20 on Windows 10/11
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &theme_value as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }
}

#[cfg(target_os = "windows")]
pub fn attach_to_desktop(my_hwnd: HWND) {
    unsafe {
        let progman = match FindWindowW(w!("Progman"), PCWSTR::null()) {
            Ok(hwnd) => hwnd,
            Err(_) => {
                println!("Failed to find Progman window.");
                return;
            }
        };

        let _ = SendMessageTimeoutW(
            progman,
            0x052C,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            None,
        );

        let worker_target = FindWindowExW(Some(progman), None, w!("WorkerW"), PCWSTR::null());

        match worker_target {
            Ok(worker_hwnd) => {
                // ۴. متصل کردن پنجره شما به WorkerW پیدا شده
                let _ = SetParent(my_hwnd, Some(worker_hwnd));
                println!("Success! Window attached to WorkerW inside Progman.");
            }
            Err(_) => {
                println!("Failed to find WorkerW inside Progman.");
            }
        }
    }
}


pub fn make_window_no_activate(hwnd: HWND) {
    unsafe {


        // 1. Get the current extended styles
        let current_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

        // 2. Combine with NOACTIVATE and TOOLWINDOW (Prevents grouping and taskbar presence strictly)
        let target_style = current_style | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize;

        // 3. Set the new extended style
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, target_style);

        // 4. Force window to the absolute BOTTOM of the Z-Order and apply styles
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_BOTTOM), // <--- Changed from null_mut() to HWND_BOTTOM
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED, // Removed SWP_NOZORDER
        );

        let verified_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let is_applied = (verified_style & WS_EX_NOACTIVATE.0 as isize) != 0;

        println!(
            "[DEBUG-ACTIVATE] WS_EX_NOACTIVATE & TOOLWINDOW: {} (Current ExStyle: {:#X})",
            if is_applied { "SUCCESSFULLY APPLIED" } else { "FAILED TO APPLY" },
            verified_style
        );
    }
}

#[cfg(target_os = "windows")]
pub fn make_window_click_through(hwnd: HWND) {
    unsafe {
        // 1. Get the current extended styles (64-bit safe)
        let current_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

        // 2. Combine with WS_EX_LAYERED and WS_EX_TRANSPARENT
        let target_style = current_style | WS_EX_LAYERED.0 as isize | WS_EX_TRANSPARENT.0 as isize;

        // 3. Set the new extended style
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, target_style);

        // 4. Force Windows to refresh the window frame and cache to apply changes immediately
        let _ = SetWindowPos(
            hwnd,
            Some(HWND(std::ptr::null_mut())),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
        );

        // 5. Verification step: Read the style back from OS to confirm application
        let verified_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let is_layered_applied = (verified_style & WS_EX_LAYERED.0 as isize) != 0;
        let is_transparent_applied = (verified_style & WS_EX_TRANSPARENT.0 as isize) != 0;

        println!(
            "[DEBUG-CLICKTHROUGH] WS_EX_LAYERED: {}, WS_EX_TRANSPARENT: {} (Current ExStyle: {:#X})",
            if is_layered_applied { "OK" } else { "FAILED" },
            if is_transparent_applied { "OK" } else { "FAILED" },
            verified_style
        );
    }
}

