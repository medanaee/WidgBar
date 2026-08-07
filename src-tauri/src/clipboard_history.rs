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
    pub html: Option<String>,
    pub rtf: Option<String>,
    pub image_path: Option<String>,
    pub file_paths: Option<Vec<String>>,
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
    // Figma HTML, spilled text JSON, or image (+ sibling thumb)
    if path.ends_with(".html")
        || path.ends_with(".json")
        || path.contains("figma_")
        || path.contains("clip_text_")
    {
        let _ = std::fs::remove_file(&p);
    } else {
        let thumb = thumb_path_beside(&p);
        let _ = std::fs::remove_file(&p);
        let _ = std::fs::remove_file(&thumb);
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardTextPayload {
    pub text: Option<String>,
    pub html: Option<String>,
    pub rtf: Option<String>,
}

fn save_clipboard_text_payload(
    text: Option<&str>,
    html: Option<&str>,
    rtf: Option<&str>,
) -> Result<PathBuf, String> {
    let dir = IMAGE_DIR
        .lock()
        .map_err(|e| format!("IMAGE_DIR lock poisoned: {e}"))?
        .clone()
        .ok_or_else(|| "IMAGE_DIR not set".to_string())?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let payload = ClipboardTextPayload {
        text: text.filter(|s| !s.is_empty()).map(|s| s.to_string()),
        html: html.filter(|s| !s.is_empty()).map(|s| s.to_string()),
        rtf: rtf.filter(|s| !s.is_empty()).map(|s| s.to_string()),
    };
    let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let hash = hash_bytes(json.as_bytes());
    let id = &hash[..12.min(hash.len())];
    let full_path = dir.join(format!("clip_text_{id}.json"));

    std::fs::write(&full_path, json)
        .map_err(|e| format!("failed to write text payload {}: {e}", full_path.display()))?;

    Ok(full_path)
}

fn load_clipboard_text_payload(path: &str) -> Result<ClipboardTextPayload, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|e| format!("failed to read text payload {path}: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("failed to parse text payload {path}: {e}"))
}

fn save_clipboard_figma(html_content: &str) -> Result<PathBuf, String> {
    let dir = IMAGE_DIR
        .lock()
        .map_err(|e| format!("IMAGE_DIR lock poisoned: {e}"))?
        .clone()
        .ok_or_else(|| "IMAGE_DIR not set".to_string())?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let hash = hash_bytes(html_content.as_bytes());
    let id = &hash[..12.min(hash.len())];
    let full_path = dir.join(format!("clip_figma_{id}.html"));

    std::fs::write(&full_path, html_content)
        .map_err(|e| format!("failed to write figma html {}: {e}", full_path.display()))?;

    Ok(full_path)
}

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
const CF_HDROP: u32 = 15;

#[cfg(target_os = "windows")]
fn register_format(name: &str) -> Option<u32> {
    use windows::core::PCWSTR;
    use windows::Win32::System::DataExchange::RegisterClipboardFormatW;

    let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let fmt = RegisterClipboardFormatW(PCWSTR(wide.as_ptr()));
        if fmt == 0 {
            None
        } else {
            Some(fmt)
        }
    }
}

#[cfg(target_os = "windows")]
fn read_hglobal_bytes(handle: windows::Win32::Foundation::HANDLE) -> Option<Vec<u8>> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    unsafe {
        let hglobal = HGLOBAL(handle.0);
        let ptr = GlobalLock(hglobal);
        if ptr.is_null() {
            return None;
        }
        let size = GlobalSize(hglobal);
        if size == 0 || size > 16 * 1024 * 1024 {
            let _ = GlobalUnlock(hglobal);
            return None;
        }
        let slice = std::slice::from_raw_parts(ptr as *const u8, size);
        let mut bytes = slice.to_vec();
        let _ = GlobalUnlock(hglobal);
        // Trim trailing NULs common in clipboard blobs
        while bytes.last().copied() == Some(0) {
            bytes.pop();
        }
        if bytes.is_empty() {
            None
        } else {
            Some(bytes)
        }
    }
}

#[cfg(target_os = "windows")]
fn read_clipboard_unicode_text_open() -> Option<String> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::DataExchange::{GetClipboardData, IsClipboardFormatAvailable};
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};

    unsafe {
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
    }
}

#[cfg(target_os = "windows")]
fn read_registered_text_format(format_name: &str) -> Option<String> {
    use windows::Win32::System::DataExchange::GetClipboardData;

    let fmt = register_format(format_name)?;
    unsafe {
        let handle = GetClipboardData(fmt).ok()?;
        let bytes = read_hglobal_bytes(handle)?;
        // HTML Format is UTF-8; RTF is typically ASCII/UTF-8
        let text = String::from_utf8_lossy(&bytes).into_owned();
        if text.trim().is_empty() {
            None
        } else {
            Some(text)
        }
    }
}

#[cfg(target_os = "windows")]
fn read_clipboard_text_bundle() -> Option<(Option<String>, Option<String>, Option<String>)> {
    use windows::Win32::System::DataExchange::{CloseClipboard, OpenClipboard};

    unsafe {
        if OpenClipboard(None).is_err() {
            return None;
        }
        let plain = read_clipboard_unicode_text_open();
        let html = read_registered_text_format("HTML Format");
        let rtf = read_registered_text_format("Rich Text Format");
        let _ = CloseClipboard();

        if plain.is_none() && html.is_none() && rtf.is_none() {
            None
        } else {
            Some((plain, html, rtf))
        }
    }
}

#[cfg(target_os = "windows")]
fn url_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16) {
                result.push(val);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).into_owned()
}

#[cfg(target_os = "windows")]
fn parse_code_file_list(text: &str) -> Vec<String> {
    let mut paths = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let path_str = if let Some(stripped) = line.strip_prefix("file:///") {
            stripped
        } else if let Some(stripped) = line.strip_prefix("file://") {
            stripped
        } else {
            line
        };

        let decoded = url_decode(path_str);
        let p = decoded.replace('/', "\\");
        if std::path::Path::new(&p).exists() {
            paths.push(p);
        }
    }
    paths
}

#[cfg(target_os = "windows")]
fn encode_path_to_uri(path_str: &str) -> String {
    let p = path_str.replace('\\', "/");
    let mut encoded = String::with_capacity(p.len() + 10);
    encoded.push_str("file:///");
    for (i, ch) in p.chars().enumerate() {
        if i == 1 && ch == ':' {
            encoded.push_str("%3A");
        } else {
            encoded.push(ch);
        }
    }
    encoded
}

#[cfg(target_os = "windows")]
fn read_clipboard_files() -> Option<Vec<String>> {
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    };
    use windows::Win32::UI::Shell::{DragQueryFileW, HDROP};

    unsafe {
        if OpenClipboard(None).is_err() {
            return None;
        }
        let result = (|| {
            // 1. First check CF_HDROP (Standard Windows Explorer format)
            if IsClipboardFormatAvailable(CF_HDROP).is_ok() {
                if let Ok(handle) = GetClipboardData(CF_HDROP) {
                    let hdrop = HDROP(handle.0);
                    let count = DragQueryFileW(hdrop, 0xFFFFFFFF, None);
                    if count > 0 {
                        let mut paths = Vec::with_capacity(count as usize);
                        for i in 0..count {
                            let needed = DragQueryFileW(hdrop, i, None);
                            if needed == 0 {
                                continue;
                            }
                            let mut buf = vec![0u16; (needed as usize) + 1];
                            let written = DragQueryFileW(hdrop, i, Some(&mut buf));
                            if written > 0 {
                                let path = String::from_utf16_lossy(&buf[..written as usize]);
                                if !path.is_empty() {
                                    paths.push(path);
                                }
                            }
                        }
                        if !paths.is_empty() {
                            return Some(paths);
                        }
                    }
                }
            }

            // 2. Second check code/file-list (VS Code custom clipboard format)
            if let Some(fmt) = register_format("code/file-list") {
                if IsClipboardFormatAvailable(fmt).is_ok() {
                    if let Ok(handle) = GetClipboardData(fmt) {
                        if let Some(bytes) = read_hglobal_bytes(handle) {
                            let text = String::from_utf8_lossy(&bytes);
                            let paths = parse_code_file_list(&text);
                            if !paths.is_empty() {
                                return Some(paths);
                            }
                        }
                    }
                }
            }

            None
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
            // First: Try reading native registered PNG format ("PNG" or "image/png")
            for fmt_name in &["PNG", "image/png"] {
                if let Some(fmt_id) = register_format(fmt_name) {
                    if IsClipboardFormatAvailable(fmt_id).is_ok() {
                        if let Ok(handle) = GetClipboardData(fmt_id) {
                            if let Some(bytes) = read_hglobal_bytes(handle) {
                                if let Ok(dyn_img) = image::load_from_memory(&bytes) {
                                    let rgba_img = dyn_img.to_rgba8();
                                    let (width, height) = (rgba_img.width(), rgba_img.height());
                                    if width > 0 && height > 0 && width <= 8000 && height <= 8000 {
                                        return Some((rgba_img.into_raw(), width, height));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Fallback: Read GDI CF_BITMAP_FMT
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

            let mut buffer = vec![0u8; (width * height * 4) as usize];
            let ok = GetDIBits(
                hdc,
                hbmp,
                0,
                height,
                Some(buffer.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );
            SelectObject(hdc, old);
            let _ = DeleteDC(hdc);

            if ok == 0 {
                return None;
            }

            let has_alpha = buffer.chunks_exact(4).any(|chunk| chunk[3] != 0 && chunk[3] != 255);
            for chunk in buffer.chunks_exact_mut(4) {
                chunk.swap(0, 2);
                if !has_alpha && chunk[3] == 0 {
                    chunk[3] = 255;
                }
            }

            Some((buffer, width, height))
        })();
        let _ = CloseClipboard();
        result
    }
}

#[cfg(target_os = "windows")]
fn alloc_hglobal_bytes(bytes: &[u8]) -> Result<windows::Win32::Foundation::HGLOBAL, String> {
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    unsafe {
        let hmem = GlobalAlloc(GMEM_MOVEABLE, bytes.len()).map_err(|e| e.to_string())?;
        let ptr = GlobalLock(hmem);
        if ptr.is_null() {
            return Err("GlobalLock failed".into());
        }
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr as *mut u8, bytes.len());
        let _ = GlobalUnlock(hmem);
        Ok(hmem)
    }
}

#[cfg(target_os = "windows")]
fn wrap_cf_html(html: &str) -> String {
    let trimmed = html.trim_start();
    if trimmed.starts_with("Version:") || trimmed.starts_with("StartHTML:") {
        return html.to_string();
    }
    let fragment = html;
    let prefix = "Version:0.9\r\nStartHTML:00000000\r\nEndHTML:00000000\r\nStartFragment:00000000\r\nEndFragment:00000000\r\n";
    let start_frag_marker = "<!--StartFragment-->";
    let end_frag_marker = "<!--EndFragment-->";
    let body = format!(
        "<!DOCTYPE html>\r\n<html>\r\n<body>\r\n{start_frag_marker}{fragment}{end_frag_marker}\r\n</body>\r\n</html>"
    );
    let header_template = "Version:0.9\r\nStartHTML:{sh:08}\r\nEndHTML:{eh:08}\r\nStartFragment:{sf:08}\r\nEndFragment:{ef:08}\r\n";
    // Compute with final header length (same digit width as template).
    let header_len = {
        let sample = format!(
            "Version:0.9\r\nStartHTML:{:08}\r\nEndHTML:{:08}\r\nStartFragment:{:08}\r\nEndFragment:{:08}\r\n",
            0, 0, 0, 0
        );
        sample.len()
    };
    let start_html = header_len;
    let start_fragment = start_html + body.find(start_frag_marker).unwrap_or(0) + start_frag_marker.len();
    let end_fragment = start_html
        + body
            .find(end_frag_marker)
            .unwrap_or(body.len().saturating_sub(end_frag_marker.len()));
    let end_html = start_html + body.len();
    let header = format!(
        "Version:0.9\r\nStartHTML:{:08}\r\nEndHTML:{:08}\r\nStartFragment:{:08}\r\nEndFragment:{:08}\r\n",
        start_html, end_html, start_fragment, end_fragment
    );
    debug_assert_eq!(header.len(), header_len);
    let _ = (prefix, header_template);
    format!("{header}{body}")
}

#[cfg(target_os = "windows")]
fn set_clipboard_formats(
    text: Option<&str>,
    html: Option<&str>,
    rtf: Option<&str>,
) -> Result<(), String> {
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    if text.is_none() && html.is_none() && rtf.is_none() {
        return Err("No formats to set".into());
    }

    unsafe {
        OpenClipboard(None).map_err(|e| e.to_string())?;
        EmptyClipboard().map_err(|e| {
            let _ = CloseClipboard();
            e.to_string()
        })?;

        if let Some(t) = text {
            let mut wide: Vec<u16> = t.encode_utf16().collect();
            wide.push(0);
            let bytes = wide.len() * 2;
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
            if let Err(e) = SetClipboardData(
                CF_TEXT_UNICODE,
                Some(windows::Win32::Foundation::HANDLE(hmem.0)),
            ) {
                let _ = CloseClipboard();
                return Err(e.to_string());
            }
        }

        if let Some(h) = html {
            let payload = wrap_cf_html(h);
            let mut bytes = payload.into_bytes();
            bytes.push(0);
            let hmem = match alloc_hglobal_bytes(&bytes) {
                Ok(h) => h,
                Err(e) => {
                    let _ = CloseClipboard();
                    return Err(e);
                }
            };
            let fmt = match register_format("HTML Format") {
                Some(f) => f,
                None => {
                    let _ = CloseClipboard();
                    return Err("RegisterClipboardFormat HTML failed".into());
                }
            };
            if let Err(e) =
                SetClipboardData(fmt, Some(windows::Win32::Foundation::HANDLE(hmem.0)))
            {
                let _ = CloseClipboard();
                return Err(e.to_string());
            }
        }

        if let Some(r) = rtf {
            let mut bytes = r.as_bytes().to_vec();
            bytes.push(0);
            let hmem = match alloc_hglobal_bytes(&bytes) {
                Ok(h) => h,
                Err(e) => {
                    let _ = CloseClipboard();
                    return Err(e);
                }
            };
            let fmt = match register_format("Rich Text Format") {
                Some(f) => f,
                None => {
                    let _ = CloseClipboard();
                    return Err("RegisterClipboardFormat RTF failed".into());
                }
            };
            if let Err(e) =
                SetClipboardData(fmt, Some(windows::Win32::Foundation::HANDLE(hmem.0)))
            {
                let _ = CloseClipboard();
                return Err(e.to_string());
            }
        }

        CloseClipboard().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_clipboard_files(paths: &[String]) -> Result<(), String> {
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::UI::Shell::DROPFILES;

    if paths.is_empty() {
        return Err("No file paths".into());
    }

    // 1. Build CF_HDROP payload (DROPFILES + wide path list)
    let mut path_blob: Vec<u16> = Vec::new();
    for p in paths {
        path_blob.extend(p.encode_utf16());
        path_blob.push(0);
    }
    path_blob.push(0);

    let header_size = std::mem::size_of::<DROPFILES>();
    let total_hdrop = header_size + path_blob.len() * 2;

    // 2. Build code/file-list payload for VS Code (file:/// URIs)
    let mut uri_list = String::new();
    for (i, p) in paths.iter().enumerate() {
        if i > 0 {
            uri_list.push('\n');
        }
        uri_list.push_str(&encode_path_to_uri(p));
    }
    let uri_bytes = uri_list.as_bytes();

    unsafe {
        OpenClipboard(None).map_err(|e| e.to_string())?;
        if let Err(e) = EmptyClipboard() {
            let _ = CloseClipboard();
            return Err(e.to_string());
        }

        // --- A. Set CF_HDROP (Windows Explorer) ---
        if let Ok(hmem_hdrop) = GlobalAlloc(GMEM_MOVEABLE, total_hdrop) {
            let ptr = GlobalLock(hmem_hdrop);
            if !ptr.is_null() {
                let dropfiles = DROPFILES {
                    pFiles: header_size as u32,
                    pt: windows::Win32::Foundation::POINT { x: 0, y: 0 },
                    fNC: windows::core::BOOL(0),
                    fWide: windows::core::BOOL(1),
                };
                std::ptr::write(ptr as *mut DROPFILES, dropfiles);
                std::ptr::copy_nonoverlapping(
                    path_blob.as_ptr() as *const u8,
                    (ptr as *mut u8).add(header_size),
                    path_blob.len() * 2,
                );
                let _ = GlobalUnlock(hmem_hdrop);
                let _ = SetClipboardData(CF_HDROP, Some(windows::Win32::Foundation::HANDLE(hmem_hdrop.0)));
            }
        }

        // --- B. Set Preferred DropEffect (DROPEFFECT_COPY = 1) ---
        if let Some(fmt_effect) = register_format("Preferred DropEffect") {
            if let Ok(hmem_effect) = GlobalAlloc(GMEM_MOVEABLE, std::mem::size_of::<u32>()) {
                let ptr = GlobalLock(hmem_effect);
                if !ptr.is_null() {
                    std::ptr::write(ptr as *mut u32, 1u32); // 1 = DROPEFFECT_COPY
                    let _ = GlobalUnlock(hmem_effect);
                    let _ = SetClipboardData(fmt_effect, Some(windows::Win32::Foundation::HANDLE(hmem_effect.0)));
                }
            }
        }

        // --- C. Set code/file-list (VS Code) ---
        if let Some(fmt_vscode) = register_format("code/file-list") {
            if let Ok(hmem_vscode) = GlobalAlloc(GMEM_MOVEABLE, uri_bytes.len() + 1) {
                let ptr = GlobalLock(hmem_vscode);
                if !ptr.is_null() {
                    std::ptr::copy_nonoverlapping(uri_bytes.as_ptr(), ptr as *mut u8, uri_bytes.len());
                    *(ptr as *mut u8).add(uri_bytes.len()) = 0;
                    let _ = GlobalUnlock(hmem_vscode);
                    let _ = SetClipboardData(fmt_vscode, Some(windows::Win32::Foundation::HANDLE(hmem_vscode.0)));
                }
            }
        }

        // --- D. Set CF_UNICODETEXT (Plain text fallback) ---
        let plain_text = paths.join("\r\n");
        let wide_plain: Vec<u16> = plain_text.encode_utf16().chain(std::iter::once(0)).collect();
        if let Ok(hmem_text) = GlobalAlloc(GMEM_MOVEABLE, wide_plain.len() * 2) {
            let ptr = GlobalLock(hmem_text);
            if !ptr.is_null() {
                std::ptr::copy_nonoverlapping(wide_plain.as_ptr() as *const u8, ptr as *mut u8, wide_plain.len() * 2);
                let _ = GlobalUnlock(hmem_text);
                let _ = SetClipboardData(CF_TEXT_UNICODE, Some(windows::Win32::Foundation::HANDLE(hmem_text.0)));
            }
        }

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

    let png_bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let dyn_img = image::load_from_memory(&png_bytes).map_err(|e| e.to_string())?;
    let width = dyn_img.width();
    let height = dyn_img.height();

    let mut buffer = dyn_img.into_rgba8().into_raw();
    for chunk in buffer.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }

    unsafe {
        let screen = GetDC(None);
        let hdc = CreateCompatibleDC(Some(screen));
        let hbmp = CreateCompatibleBitmap(screen, width as i32, height as i32);
        let old = SelectObject(hdc, HGDIOBJ(hbmp.0));

        let bmi = BITMAPINFO {
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
            buffer.as_ptr() as *const _,
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

        // 1. Set raw PNG formats ("PNG" and "image/png") for 100% transparent PNG pasting
        for fmt_name in &["PNG", "image/png"] {
            if let Some(fmt_id) = register_format(fmt_name) {
                if let Ok(hmem) = alloc_hglobal_bytes(&png_bytes) {
                    let _ = SetClipboardData(fmt_id, Some(windows::Win32::Foundation::HANDLE(hmem.0)));
                }
            }
        }

        // 2. Set CF_BITMAP_FMT as fallback for legacy GDI apps
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

/// Paste Figma item from saved disk HTML file into foreground app.
#[tauri::command]
pub fn clipboard_paste_figma(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        IGNORE_CLIPBOARD_UNTIL_MS.store(now_ms() + 1200, Ordering::Relaxed);
        let html_content = std::fs::read_to_string(&path)
            .map_err(|e| format!("failed to read figma file {path}: {e}"))?;
        set_clipboard_formats(
            None,
            Some(&html_content),
            None,
        )?;
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

/// Paste plain text (legacy) into the foreground app.
#[tauri::command]
pub fn clipboard_paste_text(text: String) -> Result<(), String> {
    clipboard_paste_formats(Some(text), None, None)
}

/// Paste text formats (plain / HTML / RTF) together, then Ctrl+V.
#[tauri::command]
pub fn clipboard_paste_formats(
    text: Option<String>,
    html: Option<String>,
    rtf: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        IGNORE_CLIPBOARD_UNTIL_MS.store(now_ms() + 1200, Ordering::Relaxed);
        set_clipboard_formats(
            text.as_deref().filter(|s| !s.is_empty()),
            html.as_deref().filter(|s| !s.is_empty()),
            rtf.as_deref().filter(|s| !s.is_empty()),
        )?;
        std::thread::sleep(std::time::Duration::from_millis(60));
        send_ctrl_v()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (text, html, rtf);
        Err("Clipboard paste is only supported on Windows".into())
    }
}

/// Paste file paths via CF_HDROP + Ctrl+V.
#[tauri::command]
pub fn clipboard_paste_files(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        IGNORE_CLIPBOARD_UNTIL_MS.store(now_ms() + 1200, Ordering::Relaxed);
        set_clipboard_files(&paths)?;
        std::thread::sleep(std::time::Duration::from_millis(60));
        send_ctrl_v()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = paths;
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

/// Delete a stored clipboard image/thumb, figma HTML, or spilled text JSON.
#[tauri::command]
pub fn clipboard_delete_image_files(path: String) -> Result<(), String> {
    remove_image_files(&path);
    Ok(())
}

/// Persist full text/html/rtf when any format is too large for the FE store.
#[tauri::command]
pub fn clipboard_save_text_payload(
    text: Option<String>,
    html: Option<String>,
    rtf: Option<String>,
) -> Result<String, String> {
    let path = save_clipboard_text_payload(
        text.as_deref(),
        html.as_deref(),
        rtf.as_deref(),
    )?;
    Ok(path.to_string_lossy().into_owned())
}

/// Load a spilled text payload from disk (paste / AI).
#[tauri::command]
pub fn clipboard_load_text_payload(path: String) -> Result<ClipboardTextPayload, String> {
    load_clipboard_text_payload(&path)
}

#[cfg(target_os = "windows")]
fn clipboard_sequence() -> u32 {
    use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
    unsafe { GetClipboardSequenceNumber() }
}

fn emit_capture(app: &AppHandle, capture: ClipboardCapture) {
    let _ = app.emit("clipboard-changed", capture);
}

fn empty_capture(kind: &str) -> ClipboardCapture {
    ClipboardCapture {
        kind: kind.into(),
        text: None,
        html: None,
        rtf: None,
        image_path: None,
        file_paths: None,
    }
}

pub fn start_clipboard_watcher(app: AppHandle) {
    if let Ok(dir) = app.path().app_cache_dir() {
        let clip_dir = dir.join("clipboard");
        if let Err(e) = std::fs::create_dir_all(&clip_dir) {
            eprintln!(
                "[clipboard] failed to create cache dir {}: {e}",
                clip_dir.display()
            );
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

            // Priority: Figma (if HTML contains (figmeta)) > real image pixels > files > text.
            let figma_capture = (|| {
                if let Some((_plain, html, _rtf)) = read_clipboard_text_bundle() {
                    if html.as_deref().map_or(false, |h| h.contains("figmeta") || h.contains("(figmeta)")) {
                        let raw_html = html.unwrap_or_default();
                        if let Ok(figma_path) = save_clipboard_figma(&raw_html) {
                            let mut c = empty_capture("figma");
                            c.html = Some(figma_path.to_string_lossy().into_owned());
                            c.text = Some("Figma Component".to_string());
                            return Some(c);
                        }
                    }
                }
                None
            })();

            if let Some(c) = figma_capture {
                emit_capture(&app, c);
            } else if let Some((rgba, w, h)) = read_clipboard_image() {
                match save_clipboard_image(&rgba, w, h) {
                    Ok(path) => {
                        let mut c = empty_capture("image");
                        c.image_path = Some(path.to_string_lossy().into_owned());
                        emit_capture(&app, c);
                    }
                    Err(e) => eprintln!("[clipboard] save image failed ({w}x{h}): {e}"),
                }
            } else if let Some(paths) = read_clipboard_files() {
                let mut c = empty_capture("files");
                c.file_paths = Some(paths);
                emit_capture(&app, c);
            } else if let Some((plain, html, rtf)) = read_clipboard_text_bundle() {
                let mut c = empty_capture("text");
                c.text = plain;
                c.html = html;
                c.rtf = rtf;
                emit_capture(&app, c);
            }
        }
    });
}
