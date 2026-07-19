//! Thin Windows clipboard bridge for the frontend.
//! Owns: watch, read, write, paste (Ctrl+V), save/delete image files on disk.
//! Does NOT own history, pin, freeze, prune, or SQLite rows.

use once_cell::sync::Lazy;
use serde::Serialize;
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

static IMAGE_DIR: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));
static IGNORE_CLIPBOARD_UNTIL_MS: std::sync::atomic::AtomicI64 =
    std::sync::atomic::AtomicI64::new(0);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardCapture {
    pub kind: String,
    pub text: Option<String>,
    pub image_path: Option<String>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes.iter().step_by(std::cmp::max(1, bytes.len() / 4096)) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100000001b3);
    }
    h ^= bytes.len() as u64;
    format!("{:016x}", h)
}

fn thumb_path_beside(full: &std::path::Path) -> PathBuf {
    let stem = full
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "clip".into());
    full.with_file_name(format!("{stem}_t.png"))
}

fn remove_image_files(path: &str) {
    let p = PathBuf::from(path);
    let thumb = thumb_path_beside(&p);
    let _ = std::fs::remove_file(&p);
    let _ = std::fs::remove_file(&thumb);
}

/// Saves full-quality PNG + a small PNG thumb. Returns full path.
fn save_clipboard_image(rgba: &[u8], width: u32, height: u32) -> Result<PathBuf, String> {
    let dir = IMAGE_DIR
        .lock()
        .map_err(|e| format!("IMAGE_DIR lock poisoned: {e}"))?
        .clone()
        .ok_or_else(|| "IMAGE_DIR not set".to_string())?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let img = image::RgbaImage::from_raw(width, height, rgba.to_vec())
        .ok_or_else(|| format!("invalid RGBA buffer ({}x{}, {} bytes)", width, height, rgba.len()))?;
    let dyn_img = image::DynamicImage::ImageRgba8(img);

    let hash = hash_bytes(rgba);
    let id = &hash[..12.min(hash.len())];
    let full_path = dir.join(format!("clip_{id}.png"));
    let thumb_path = dir.join(format!("clip_{id}_t.png"));

    dyn_img
        .save_with_format(&full_path, image::ImageFormat::Png)
        .map_err(|e| format!("failed to save PNG {}: {e}", full_path.display()))?;

    let thumb = dyn_img.thumbnail(256, 256);
    let mut buf = Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| {
            let _ = std::fs::remove_file(&full_path);
            format!("failed to encode thumb for {}: {e}", full_path.display())
        })?;
    std::fs::write(&thumb_path, buf.into_inner()).map_err(|e| {
        let _ = std::fs::remove_file(&full_path);
        format!("failed to write thumb {}: {e}", thumb_path.display())
    })?;

    Ok(full_path)
}

#[cfg(target_os = "windows")]
const CF_TEXT_UNICODE: u32 = 13;
#[cfg(target_os = "windows")]
const CF_BITMAP_FMT: u32 = 2;

#[cfg(target_os = "windows")]
fn read_clipboard_text() -> Option<String> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    };
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};

    unsafe {
        if OpenClipboard(None).is_err() {
            return None;
        }
        let result = (|| {
            if IsClipboardFormatAvailable(CF_TEXT_UNICODE).is_err() {
                return None;
            }
            let handle = GetClipboardData(CF_TEXT_UNICODE).ok()?;
            let hglobal = HGLOBAL(handle.0);
            let ptr = GlobalLock(hglobal);
            if ptr.is_null() {
                return None;
            }
            let wide = ptr as *const u16;
            let mut len = 0usize;
            while *wide.add(len) != 0 {
                len += 1;
                if len > 2_000_000 {
                    break;
                }
            }
            let slice = std::slice::from_raw_parts(wide, len);
            let text = String::from_utf16_lossy(slice);
            let _ = GlobalUnlock(hglobal);
            if text.trim().is_empty() {
                None
            } else {
                Some(text)
            }
        })();
        let _ = CloseClipboard();
        result
    }
}

#[cfg(target_os = "windows")]
fn read_clipboard_image() -> Option<(Vec<u8>, u32, u32)> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, GetDIBits, GetObjectW, SelectObject, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
    };
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    };

    unsafe {
        if OpenClipboard(None).is_err() {
            return None;
        }
        let result = (|| {
            if IsClipboardFormatAvailable(CF_BITMAP_FMT).is_err() {
                return None;
            }
            let handle = GetClipboardData(CF_BITMAP_FMT).ok()?;
            let hbmp = HBITMAP(handle.0);
            let mut bm = BITMAP::default();
            if GetObjectW(
                HGDIOBJ(hbmp.0),
                std::mem::size_of::<BITMAP>() as i32,
                Some(&mut bm as *mut _ as *mut _),
            ) == 0
            {
                return None;
            }
            let width = bm.bmWidth as u32;
            let height = bm.bmHeight.unsigned_abs();
            if width == 0 || height == 0 || width > 8000 || height > 8000 {
                return None;
            }

            let hdc = CreateCompatibleDC(None);
            if hdc.is_invalid() {
                return None;
            }
            let old = SelectObject(hdc, HGDIOBJ(hbmp.0));

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width as i32,
                    biHeight: -(height as i32),
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0 as u32,
                    ..Default::default()
                },
                ..Default::default()
            };

            let mut bgra = vec![0u8; (width * height * 4) as usize];
            let ok = GetDIBits(
                hdc,
                hbmp,
                0,
                height,
                Some(bgra.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );
            SelectObject(hdc, old);
            let _ = DeleteDC(hdc);

            if ok == 0 {
                return None;
            }

            let mut rgba = vec![0u8; bgra.len()];
            for i in 0..(width * height) as usize {
                let o = i * 4;
                rgba[o] = bgra[o + 2];
                rgba[o + 1] = bgra[o + 1];
                rgba[o + 2] = bgra[o];
                rgba[o + 3] = 255;
            }
            Some((rgba, width, height))
        })();
        let _ = CloseClipboard();
        result
    }
}

#[cfg(target_os = "windows")]
fn set_clipboard_text(text: &str) -> Result<(), String> {
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    let mut wide: Vec<u16> = text.encode_utf16().collect();
    wide.push(0);
    let bytes = wide.len() * 2;

    unsafe {
        OpenClipboard(None).map_err(|e| e.to_string())?;
        EmptyClipboard().map_err(|e| {
            let _ = CloseClipboard();
            e.to_string()
        })?;
        let hmem = GlobalAlloc(GMEM_MOVEABLE, bytes).map_err(|e| {
            let _ = CloseClipboard();
            e.to_string()
        })?;
        let ptr = GlobalLock(hmem);
        if ptr.is_null() {
            let _ = CloseClipboard();
            return Err("GlobalLock failed".into());
        }
        std::ptr::copy_nonoverlapping(wide.as_ptr() as *const u8, ptr as *mut u8, bytes);
        let _ = GlobalUnlock(hmem);
        SetClipboardData(CF_TEXT_UNICODE, Some(windows::Win32::Foundation::HANDLE(hmem.0))).map_err(
            |e| {
                let _ = CloseClipboard();
                e.to_string()
            },
        )?;
        CloseClipboard().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_clipboard_image_from_file(path: &str) -> Result<(), String> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, ReleaseDC,
        SelectObject, SetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };

    let dyn_img = image::open(path).map_err(|e| e.to_string())?;
    let rgba = dyn_img.to_rgba8();
    let width = rgba.width();
    let height = rgba.height();
    let mut bgra = vec![0u8; (width * height * 4) as usize];
    for (i, px) in rgba.pixels().enumerate() {
        let o = i * 4;
        bgra[o] = px[2];
        bgra[o + 1] = px[1];
        bgra[o + 2] = px[0];
        bgra[o + 3] = px[3];
    }

    unsafe {
        let screen = GetDC(None);
        let hdc = CreateCompatibleDC(Some(screen));
        let hbmp = CreateCompatibleBitmap(screen, width as i32, height as i32);
        let old = SelectObject(hdc, HGDIOBJ(hbmp.0));

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                ..Default::default()
            },
            ..Default::default()
        };

        SetDIBits(
            Some(hdc),
            hbmp,
            0,
            height,
            bgra.as_ptr() as *const _,
            &bmi,
            DIB_RGB_COLORS,
        );
        SelectObject(hdc, old);
        let _ = DeleteDC(hdc);
        ReleaseDC(None, screen);

        OpenClipboard(None).map_err(|e| e.to_string())?;
        EmptyClipboard().map_err(|e| {
            let _ = CloseClipboard();
            e.to_string()
        })?;
        SetClipboardData(
            CF_BITMAP_FMT,
            Some(windows::Win32::Foundation::HANDLE(hbmp.0)),
        )
        .map_err(|e| {
            let _ = DeleteObject(HGDIOBJ(hbmp.0));
            let _ = CloseClipboard();
            e.to_string()
        })?;
        CloseClipboard().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn send_ctrl_v() -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY,
        VK_CONTROL, VK_V,
    };

    unsafe {
        let mut inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: windows::Win32::UI::Input::KeyboardAndMouse::KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: windows::Win32::UI::Input::KeyboardAndMouse::KEYBDINPUT {
                        wVk: VIRTUAL_KEY(VK_V.0),
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: windows::Win32::UI::Input::KeyboardAndMouse::KEYBDINPUT {
                        wVk: VIRTUAL_KEY(VK_V.0),
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: windows::Win32::UI::Input::KeyboardAndMouse::KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        let sent = SendInput(&mut inputs, std::mem::size_of::<INPUT>() as i32);
        if sent == 0 {
            Err("SendInput failed".into())
        } else {
            Ok(())
        }
    }
}

#[cfg(target_os = "windows")]
fn clipboard_sequence() -> u32 {
    use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
    unsafe { GetClipboardSequenceNumber() }
}

fn emit_capture(app: &AppHandle, capture: ClipboardCapture) {
    let _ = app.emit("clipboard-changed", capture);
}

pub fn start_clipboard_watcher(app: AppHandle) {
    if let Ok(dir) = app.path().app_cache_dir() {
        let clip_dir = dir.join("clipboard");
        if let Err(e) = std::fs::create_dir_all(&clip_dir) {
            eprintln!("[clipboard] failed to create cache dir {}: {e}", clip_dir.display());
        } else if let Ok(mut g) = IMAGE_DIR.lock() {
            *g = Some(clip_dir);
        }
    }

    #[cfg(target_os = "windows")]
    std::thread::spawn(move || {
        let mut last_seq = clipboard_sequence();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(400));
            let seq = clipboard_sequence();
            if seq == last_seq {
                continue;
            }
            last_seq = seq;

            if now_ms() < IGNORE_CLIPBOARD_UNTIL_MS.load(Ordering::Relaxed) {
                continue;
            }

            if let Some(text) = read_clipboard_text() {
                emit_capture(
                    &app,
                    ClipboardCapture {
                        kind: "text".into(),
                        text: Some(text),
                        image_path: None,
                    },
                );
            } else if let Some((rgba, w, h)) = read_clipboard_image() {
                match save_clipboard_image(&rgba, w, h) {
                    Ok(path) => {
                        emit_capture(
                            &app,
                            ClipboardCapture {
                                kind: "image".into(),
                                text: None,
                                image_path: Some(path.to_string_lossy().into_owned()),
                            },
                        );
                    }
                    Err(e) => eprintln!("[clipboard] save image failed ({w}x{h}): {e}"),
                }
            }
        }
    });
}

/// Paste text into the foreground app (set clipboard + Ctrl+V).
#[tauri::command]
pub fn clipboard_paste_text(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        IGNORE_CLIPBOARD_UNTIL_MS.store(now_ms() + 1200, Ordering::Relaxed);
        set_clipboard_text(&text)?;
        std::thread::sleep(std::time::Duration::from_millis(60));
        send_ctrl_v()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Err("Clipboard paste is only supported on Windows".into())
    }
}

/// Paste image file into the foreground app (set clipboard + Ctrl+V).
#[tauri::command]
pub fn clipboard_paste_image(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        IGNORE_CLIPBOARD_UNTIL_MS.store(now_ms() + 1200, Ordering::Relaxed);
        set_clipboard_image_from_file(&path)?;
        std::thread::sleep(std::time::Duration::from_millis(60));
        send_ctrl_v()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("Clipboard paste is only supported on Windows".into())
    }
}

/// Delete a stored clipboard image and its thumb from disk.
#[tauri::command]
pub fn clipboard_delete_image_files(path: String) -> Result<(), String> {
    remove_image_files(&path);
    Ok(())
}
