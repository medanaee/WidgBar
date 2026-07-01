use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use tauri::WebviewWindow;
use tauri::{AppHandle, Manager, State};
use tauri::{WebviewUrl, WebviewWindowBuilder};

use windows::core::Interface;
use windows::System::DispatcherQueueController;
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Dwm::DWMWA_EXCLUDED_FROM_PEEK;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::{
    SHAppBarMessage, ABE_TOP, ABM_NEW, ABM_QUERYPOS, ABM_SETPOS, APPBARDATA,
};
use windows::Win32::{
    Foundation::{HWND, POINT, RECT},
    Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_USE_HOSTBACKDROPBRUSH},
    Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, ScreenToClient, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    },
    System::WinRT::{
        Composition::ICompositorDesktopInterop, CreateDispatcherQueueController,
        DispatcherQueueOptions, DQTAT_COM_NONE, DQTYPE_THREAD_CURRENT,
    },
    UI::WindowsAndMessaging::{
        GetCursorPos, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_LAYERED,
        WS_EX_NOREDIRECTIONBITMAP, WS_EX_TRANSPARENT,
    },
};
use windows::UI::Composition::{
    CompositionBrush, Compositor, ContainerVisual, Desktop::DesktopWindowTarget, SpriteVisual,
};
use windows_numerics::{Vector2, Vector3};

use crate::windows_utils::*;

// -------------------------------------------------------------------
// Centralized Global Registries (Global Statics)
// -------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarInfo {
    pub id: String,
    pub monitor_id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetAreaInfo {
    pub id: String,
    pub monitor_id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionInfo {
    pub id: String,
    pub window_label: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub border_radius: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LayoutState {
    pub monitors: HashMap<String, MonitorInfo>,
    pub bars: HashMap<String, BarInfo>,
    pub widget_areas: HashMap<String, WidgetAreaInfo>,
    pub regions: HashMap<String, RegionInfo>,
}

static LAYOUT_STATE: OnceLock<Mutex<LayoutState>> = OnceLock::new();

pub fn get_layout_state() -> &'static Mutex<LayoutState> {
    LAYOUT_STATE.get_or_init(|| Mutex::new(LayoutState::default()))
}

static APPBAR_BOUNDS: OnceLock<Mutex<HashMap<isize, RECT>>> = OnceLock::new();

fn get_appbar_bounds() -> &'static Mutex<HashMap<isize, RECT>> {
    APPBAR_BOUNDS.get_or_init(|| Mutex::new(HashMap::new()))
}

static WIDGET_REGIONS: OnceLock<Mutex<HashMap<isize, HashMap<String, RECT>>>> = OnceLock::new();
static WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(1);

static TRANSPARENCY_STATE: OnceLock<Mutex<HashMap<isize, bool>>> = OnceLock::new();
static DRAG_STATES: OnceLock<Mutex<HashMap<isize, bool>>> = OnceLock::new();
static TRACKER_STARTED: OnceLock<bool> = OnceLock::new();

pub struct WindowWidgetData {
    pub _controller: Option<DispatcherQueueController>,
    pub _target: DesktopWindowTarget,
    pub root_container: ContainerVisual,
    pub backdrop_brush: CompositionBrush,
    pub compositor: Compositor,
    pub visuals: HashMap<String, SpriteVisual>,
}

pub struct SharedWidgetState(pub Arc<Mutex<HashMap<String, WindowWidgetData>>>);

impl Default for SharedWidgetState {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }
}

fn get_regions() -> &'static Mutex<HashMap<isize, HashMap<String, RECT>>> {
    WIDGET_REGIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_states() -> &'static Mutex<HashMap<isize, bool>> {
    TRANSPARENCY_STATE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_dragging_states() -> &'static Mutex<HashMap<isize, bool>> {
    DRAG_STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn start_mouse_tracker() {
    if TRACKER_STARTED.get().is_some() {
        return;
    }
    TRACKER_STARTED.set(true).unwrap();

    thread::spawn(|| {
        println!("[DEBUG] Mouse Tracker Thread Started.");
        loop {
            let mut pt = POINT { x: 0, y: 0 };
            unsafe { GetCursorPos(&mut pt) };

            let updates = {
                let regions_map = get_regions().lock().unwrap();
                let drag_states = get_dragging_states().lock().unwrap();
                let mut states = get_states().lock().unwrap();

                let mut required_updates = Vec::new();

                for (hwnd_ptr, rects) in regions_map.iter() {
                    let hwnd = HWND(*hwnd_ptr as _);
                    let mut client_pt = pt;
                    unsafe { ScreenToClient(hwnd, &mut client_pt) };

                    let mut hit = false;
                    for r in rects.values() {
                        if client_pt.x >= r.left
                            && client_pt.x <= r.right
                            && client_pt.y >= r.top
                            && client_pt.y <= r.bottom
                        {
                            hit = true;
                            break;
                        }
                    }

                    if *drag_states.get(hwnd_ptr).unwrap_or(&false) {
                        hit = true;
                    }

                    let currently_transparent = states.get(hwnd_ptr).copied().unwrap_or(true);

                    if hit && currently_transparent {
                        states.insert(*hwnd_ptr, false);
                        required_updates.push((*hwnd_ptr, false));
                    } else if !hit && !currently_transparent {
                        states.insert(*hwnd_ptr, true);
                        required_updates.push((*hwnd_ptr, true));
                    }
                }
                required_updates
            };

            for (hwnd_ptr, make_transparent) in updates {
                let hwnd = HWND(hwnd_ptr as _);
                unsafe {
                    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                    if make_transparent {
                        SetWindowLongPtrW(
                            hwnd,
                            GWL_EXSTYLE,
                            ex_style | WS_EX_TRANSPARENT.0 as isize | WS_EX_LAYERED.0 as isize,
                        );
                    } else {
                        SetWindowLongPtrW(
                            hwnd,
                            GWL_EXSTYLE,
                            ex_style & !(WS_EX_TRANSPARENT.0 as isize),
                        );
                    }

                    let _ = SetWindowPos(
                        hwnd,
                        Some(HWND(std::ptr::null_mut())),
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
                    );
                }
            }

            thread::sleep(Duration::from_millis(16)); // ~60fps
        }
    });
}

#[tauri::command]
pub fn init_monitors(app: AppHandle) -> Result<LayoutState, String> {
    let monitors = app
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {}", e))?;

    let primary_monitor_name = app
        .primary_monitor()
        .unwrap_or(None)
        .and_then(|m| m.name().cloned());

    let mut new_monitors = HashMap::new();

    for (index, monitor) in monitors.into_iter().enumerate() {
        let pos = monitor.position();

        let mut work_area_x = pos.x as f64;
        let mut work_area_y = pos.y as f64;
        let mut work_area_width = monitor.size().width as f64;
        let mut work_area_height = monitor.size().height as f64;

        #[cfg(target_os = "windows")]
        unsafe {
            let pt = POINT {
                x: pos.x as i32,
                y: pos.y as i32,
            };
            let hmonitor = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);

            if !hmonitor.is_invalid() {
                let mut mi = MONITORINFO {
                    cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                    ..Default::default()
                };

                if GetMonitorInfoW(hmonitor, &mut mi).into() {
                    work_area_x = mi.rcWork.left as f64;
                    work_area_y = mi.rcWork.top as f64;
                    work_area_width = (mi.rcWork.right - mi.rcWork.left) as f64;
                    work_area_height = (mi.rcWork.bottom - mi.rcWork.top) as f64;
                }
            }
        }

        let monitor_name = monitor
            .name()
            .cloned()
            .unwrap_or_else(|| format!("Display {}", index + 1));

        let is_primary = if let Some(ref p_name) = primary_monitor_name {
            *p_name == monitor_name
        } else {
            pos.x == 0 && pos.y == 0
        };

        let id = format!("monitor_{}", index);

        new_monitors.insert(
            id.clone(),
            MonitorInfo {
                id,
                name: monitor_name,
                width: work_area_width,
                height: work_area_height,
                x: work_area_x,
                y: work_area_y,
                is_primary
            },
        );
    }

    let layout = {
        let mut state = get_layout_state().lock().unwrap();
        state.monitors = new_monitors;
        state.clone()
    };

    Ok(layout)
}

#[tauri::command]
pub fn get_layout() -> LayoutState {
    get_layout_state().lock().unwrap().clone()
}

#[cfg(target_os = "windows")]
pub fn setup_windows_appbar(window: &WebviewWindow, monitor: &tauri::Monitor, dock_height: u32) {
    let hwnd_val = window.hwnd().expect("Failed to get window handle");
    let hwnd = HWND(hwnd_val.0 as _);

    apply_persistent_acrylic(hwnd);

    let mut appbar_data = APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        hWnd: hwnd,
        uEdge: ABE_TOP,
        ..Default::default()
    };

    unsafe {
        SHAppBarMessage(ABM_NEW, &mut appbar_data);
    }
    let exclude_from_peek: i32 = 1;
    unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_EXCLUDED_FROM_PEEK,
            &exclude_from_peek as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }

    let pos = monitor.position();
    let size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let physical_dock_height = (dock_height as f64 * scale_factor).round() as i32;

    appbar_data.rc = RECT {
        left: pos.x as i32,
        top: pos.y as i32,
        right: (pos.x as i32) + (size.width as i32),
        bottom: (pos.y as i32) + physical_dock_height,
    };

    unsafe {
        SHAppBarMessage(ABM_QUERYPOS, &mut appbar_data);
        SHAppBarMessage(ABM_SETPOS, &mut appbar_data);
    }

    let allocated_height = appbar_data.rc.bottom - appbar_data.rc.top;

    window
        .set_position(tauri::PhysicalPosition::new(
            appbar_data.rc.left,
            appbar_data.rc.top,
        ))
        .unwrap();
    window
        .set_size(tauri::PhysicalSize::new(
            (appbar_data.rc.right - appbar_data.rc.left) as u32,
            allocated_height as u32,
        ))
        .unwrap();

    let expected_rect = RECT {
        left: appbar_data.rc.left,
        top: appbar_data.rc.top,
        right: appbar_data.rc.right,
        bottom: appbar_data.rc.bottom,
    };
    get_appbar_bounds().lock().unwrap().insert(hwnd.0 as isize, expected_rect);

    let win_clone = window.clone();
    let hwnd_val = hwnd.0 as isize;

    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Moved(pos) => {
            if let Some(bounds) = get_appbar_bounds().lock().unwrap().get(&hwnd_val) {
                if pos.x != bounds.left || pos.y != bounds.top {
                    let _ = win_clone.set_position(tauri::PhysicalPosition::new(bounds.left, bounds.top));
                }
            }
        }
        tauri::WindowEvent::Resized(size) => {
            if let Some(bounds) = get_appbar_bounds().lock().unwrap().get(&hwnd_val) {
                let expected_width = (bounds.right - bounds.left) as u32;
                let expected_height = (bounds.bottom - bounds.top) as u32;
                if size.width != expected_width || size.height != expected_height {
                    let _ = win_clone.set_size(tauri::PhysicalSize::new(expected_width, expected_height));
                }
            }
        }
        _ => {}
    });
}

#[tauri::command]
pub async fn update_bar_height(app: AppHandle, id: String, height: u32) -> Result<(), String> {
    let state = get_layout_state().lock().unwrap();
    let bar_info = state.bars.get(&id).ok_or("Bar not found")?.clone();
    let monitor_info = state.monitors.get(&bar_info.monitor_id).ok_or("Monitor not found")?.clone();
    drop(state);

    if let Some(window) = app.get_webview_window(&bar_info.label) {
        let monitors = app.available_monitors().map_err(|e| e.to_string())?;
        let tauri_monitor = monitors
            .into_iter()
            .find(|m| m.name().cloned().unwrap_or_default() == monitor_info.name)
            .ok_or("Could not find tauri monitor")?;

        #[cfg(target_os = "windows")]
        {
            let hwnd_val = window.hwnd().expect("Failed to get window handle");
            let hwnd = HWND(hwnd_val.0 as _);

            let mut appbar_data = APPBARDATA {
                cbSize: std::mem::size_of::<APPBARDATA>() as u32,
                hWnd: hwnd,
                uEdge: ABE_TOP,
                ..Default::default()
            };

            let pos = tauri_monitor.position();
            let size = tauri_monitor.size();
            let scale_factor = tauri_monitor.scale_factor();
            let physical_height = (height as f64 * scale_factor).round() as i32;

            appbar_data.rc = RECT {
                left: pos.x as i32,
                top: pos.y as i32,
                right: (pos.x as i32) + (size.width as i32),
                bottom: (pos.y as i32) + physical_height,
            };

            unsafe {
                SHAppBarMessage(ABM_QUERYPOS, &mut appbar_data);
                SHAppBarMessage(ABM_SETPOS, &mut appbar_data);
            }

            let expected_rect = RECT {
                left: appbar_data.rc.left,
                top: appbar_data.rc.top,
                right: appbar_data.rc.right,
                bottom: appbar_data.rc.bottom,
            };
            get_appbar_bounds().lock().unwrap().insert(hwnd.0 as isize, expected_rect);

            let allocated_height = appbar_data.rc.bottom - appbar_data.rc.top;
            
            let _ = window.set_position(tauri::PhysicalPosition::new(appbar_data.rc.left, appbar_data.rc.top));
            let _ = window.set_size(tauri::PhysicalSize::new((appbar_data.rc.right - appbar_data.rc.left) as u32, allocated_height as u32));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_bar(app: AppHandle, monitor_id: String, height: u32) -> Result<String, String> {
    {
        let state = get_layout_state().lock().unwrap();
        for (id, bar) in state.bars.iter() {
            if bar.monitor_id == monitor_id {
                if app.get_webview_window(&bar.label).is_some() {
                    return Ok(id.clone());
                }
            }
        }
    }
    let state = get_layout_state().lock().unwrap();
    let monitor_info = state
        .monitors
        .get(&monitor_id)
        .ok_or("Monitor not found")?
        .clone();
    drop(state);

    let id = format!("bar_{}", WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst));
    let label = id.clone();

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let tauri_monitor = monitors
        .into_iter()
        .find(|m| m.name().cloned().unwrap_or_default() == monitor_info.name)
        .ok_or("Could not find tauri monitor")?;

    let builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html/#bar/{}", monitor_id).into()),
    )
    .transparent(true)
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .skip_taskbar(true)
    .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        setup_windows_appbar(&window, &tauri_monitor, height);
        if let Ok(hwnd_val) = window.hwnd() {
            let hwnd = HWND(hwnd_val.0 as _);
            set_os_window_animation(hwnd, false);
        }
    }

    window.show().ok();

    let mut state = get_layout_state().lock().unwrap();
    state.bars.insert(
        id.clone(),
        BarInfo {
            id: id.clone(),
            monitor_id,
            label,
        },
    );

    Ok(id)
}

#[tauri::command]
pub async fn remove_bar(app: AppHandle, monitor_id: String) -> Result<(), String> {
    let mut state = get_layout_state().lock().unwrap();
    let mut target_id = None;
    for (id, bar) in state.bars.iter() {
        if bar.monitor_id == monitor_id {
            target_id = Some(id.clone());
            break;
        }
    }

    if let Some(id) = target_id {
        if let Some(bar) = state.bars.remove(&id) {
            if let Some(window) = app.get_webview_window(&bar.label) {
                #[cfg(target_os = "windows")]
                if let Ok(hwnd_val) = window.hwnd() {
                    let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
                    let mut appbar_data = windows::Win32::UI::Shell::APPBARDATA {
                        cbSize: std::mem::size_of::<windows::Win32::UI::Shell::APPBARDATA>() as u32,
                        hWnd: hwnd,
                        ..Default::default()
                    };
                    unsafe {
                        windows::Win32::UI::Shell::SHAppBarMessage(windows::Win32::UI::Shell::ABM_REMOVE, &mut appbar_data);
                    }
                }
                window.close().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_widget_area(app: AppHandle, monitor_id: String) -> Result<String, String> {
    {
        let state = get_layout_state().lock().unwrap();
        for (id, area) in state.widget_areas.iter() {
            if area.monitor_id == monitor_id {
                if app.get_webview_window(&area.label).is_some() {
                    return Ok(id.clone());
                }
            }
        }
    }
    let state = get_layout_state().lock().unwrap();
    let monitor_info = state
        .monitors
        .get(&monitor_id)
        .ok_or("Monitor not found")?
        .clone();
    drop(state);

    start_mouse_tracker();

    let id = format!(
        "widget_area_{}",
        WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let label = id.clone();

    let builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html/#widget_area/{}", monitor_id).into()),
    )
    .position(monitor_info.x, monitor_info.y)
    .inner_size(monitor_info.width, monitor_info.height)
    .transparent(true)
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .skip_taskbar(true)
    .always_on_bottom(true)
    .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd_val) = window.hwnd() {
            let hwnd = HWND(hwnd_val.0 as _);
            set_os_window_animation(hwnd, false);
            make_window_click_through(hwnd);
        }
    }

    window.show().ok();

    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd_val) = window.hwnd() {
            let hwnd = HWND(hwnd_val.0 as _);
            set_os_window_animation(hwnd, false);
            make_window_click_through(hwnd);
        }
    }

    let mut state = get_layout_state().lock().unwrap();
    state.widget_areas.insert(
        id.clone(),
        WidgetAreaInfo {
            id: id.clone(),
            monitor_id,
            label,
        },
    );

    Ok(id)
}

#[tauri::command]
pub async fn remove_widget_area(app: AppHandle, monitor_id: String) -> Result<(), String> {
    let mut state = get_layout_state().lock().unwrap();
    let mut target_id = None;
    for (id, area) in state.widget_areas.iter() {
        if area.monitor_id == monitor_id {
            target_id = Some(id.clone());
            break;
        }
    }

    if let Some(id) = target_id {
        if let Some(area) = state.widget_areas.remove(&id) {
            if let Some(window) = app.get_webview_window(&area.label) {
                window.close().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn request_region(
    app: AppHandle,
    label: String,
    widget_id: String,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    border_radius: f32,
    state: State<'_, SharedWidgetState>,
) -> Result<(), String> {
    let window = app.get_webview_window(&label).ok_or("Window not found")?;
    let hwnd_ptr = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
    let scale_factor = window.scale_factor().unwrap_or(1.0) as f32;
    let state_arc = state.0.clone();
    let label_clone = label.clone();
    let widget_id_clone = widget_id.clone();

    let phys_x = x;
    let phys_y = y;
    let phys_w = width;
    let phys_h = height;
    let phys_radius = border_radius;

    start_mouse_tracker();

    {
        let mut layout_state = get_layout_state().lock().unwrap();
        layout_state.regions.insert(
            widget_id_clone.clone(),
            RegionInfo {
                id: widget_id_clone.clone(),
                window_label: label_clone.clone(),
                x,
                y,
                width,
                height,
                border_radius,
            },
        );
    }

    let _ = app.run_on_main_thread(move || {
        let hwnd = HWND(hwnd_ptr as _);
        let mut state_guard = state_arc.lock().unwrap();

        if !state_guard.contains_key(&label_clone) {
            unsafe {
                let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                SetWindowLongPtrW(
                    hwnd,
                    GWL_EXSTYLE,
                    ex_style
                        | WS_EX_NOREDIRECTIONBITMAP.0 as isize
                        | WS_EX_LAYERED.0 as isize
                        | WS_EX_TRANSPARENT.0 as isize,
                );

                let _ = SetWindowPos(
                    hwnd,
                    Some(HWND(std::ptr::null_mut())),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
                );

                let enable_host_backdrop: i32 = 1;
                let _ = DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_USE_HOSTBACKDROPBRUSH,
                    &enable_host_backdrop as *const i32 as *const _,
                    std::mem::size_of::<i32>() as u32,
                );

                let options = DispatcherQueueOptions {
                    dwSize: std::mem::size_of::<DispatcherQueueOptions>() as u32,
                    threadType: DQTYPE_THREAD_CURRENT,
                    apartmentType: DQTAT_COM_NONE,
                };
                let controller = CreateDispatcherQueueController(options).ok();

                let compositor = Compositor::new().expect("Failed to create Compositor");
                let interop: ICompositorDesktopInterop = compositor.cast().unwrap();
                let target = interop.CreateDesktopWindowTarget(hwnd, false).unwrap();

                let root_container = compositor.CreateContainerVisual().unwrap();
                target.SetRoot(&root_container).unwrap();

                let backdrop_brush_raw = compositor.CreateHostBackdropBrush().unwrap();
                let backdrop_brush: CompositionBrush = backdrop_brush_raw.cast().unwrap();

                state_guard.insert(
                    label_clone.clone(),
                    WindowWidgetData {
                        _controller: controller,
                        _target: target,
                        root_container,
                        backdrop_brush,
                        compositor,
                        visuals: HashMap::new(),
                    },
                );
            }
        }

        let rect = RECT {
            left: phys_x as i32,
            top: phys_y as i32,
            right: (phys_x + phys_w) as i32,
            bottom: (phys_y + phys_h) as i32,
        };

        {
            let mut regions_map = get_regions().lock().unwrap();
            let rects = regions_map.entry(hwnd_ptr).or_insert_with(HashMap::new);
            rects.insert(widget_id_clone.clone(), rect);
        }

        if let Some(window_data) = state_guard.get_mut(&label_clone) {
            if let Some(existing_visual) = window_data.visuals.get(&widget_id_clone) {
                let _ = existing_visual.SetSize(Vector2 {
                    X: phys_w,
                    Y: phys_h,
                });
                let _ = existing_visual.SetOffset(Vector3 {
                    X: phys_x,
                    Y: phys_y,
                    Z: 0.0,
                });

                if let Ok(geometry) = window_data.compositor.CreateRoundedRectangleGeometry() {
                    let _ = geometry.SetCornerRadius(Vector2 {
                        X: phys_radius,
                        Y: phys_radius,
                    });
                    let _ = geometry.SetSize(Vector2 {
                        X: phys_w,
                        Y: phys_h,
                    });
                    if let Ok(clip) = window_data
                        .compositor
                        .CreateGeometricClipWithGeometry(&geometry)
                    {
                        let _ = existing_visual.SetClip(&clip);
                    }
                }
            } else {
                if let Ok(visual) = window_data.compositor.CreateSpriteVisual() {
                    let _ = visual.SetBrush(&window_data.backdrop_brush);
                    let _ = visual.SetSize(Vector2 {
                        X: phys_w,
                        Y: phys_h,
                    });
                    let _ = visual.SetOffset(Vector3 {
                        X: phys_x,
                        Y: phys_y,
                        Z: 0.0,
                    });

                    if let Ok(geometry) = window_data.compositor.CreateRoundedRectangleGeometry() {
                        let _ = geometry.SetCornerRadius(Vector2 {
                            X: phys_radius,
                            Y: phys_radius,
                        });
                        let _ = geometry.SetSize(Vector2 {
                            X: phys_w,
                            Y: phys_h,
                        });

                        if let Ok(clip) = window_data
                            .compositor
                            .CreateGeometricClipWithGeometry(&geometry)
                        {
                            let _ = visual.SetClip(&clip);
                        }
                    }

                    let _ = window_data
                        .root_container
                        .Children()
                        .unwrap()
                        .InsertAtTop(&visual);
                    window_data.visuals.insert(widget_id_clone.clone(), visual);
                }
            }
        }
    });

    println!("[DEBUG] Requested region mapped to ID: {}", widget_id);
    Ok(())
}

#[tauri::command]
pub async fn remove_region(
    app: AppHandle,
    label: String,
    widget_id: String,
    state: State<'_, SharedWidgetState>,
) -> Result<(), String> {
    let window = app.get_webview_window(&label).ok_or("Window not found")?;
    let hwnd_ptr = window.hwnd().map_err(|e| e.to_string())?.0 as isize;

    {
        let mut map = get_regions().lock().unwrap();
        if let Some(rects) = map.get_mut(&hwnd_ptr) {
            rects.remove(&widget_id);
        }
    }

    {
        let mut layout_state = get_layout_state().lock().unwrap();
        layout_state.regions.remove(&widget_id);
    }

    let state_arc = state.0.clone();
    let _ = app.run_on_main_thread(move || {
        let mut state_guard = state_arc.lock().unwrap();
        if let Some(data) = state_guard.get_mut(&label) {
            if let Some(visual) = data.visuals.remove(&widget_id) {
                if let Ok(children) = data.root_container.Children() {
                    let _ = children.Remove(&visual);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn start_change_region(
    app: AppHandle,
    label: String,
    widget_id: String,
    state: State<'_, SharedWidgetState>,
) -> Result<(), String> {
    let window = app.get_webview_window(&label).ok_or("Window not found")?;
    let hwnd_ptr = window.hwnd().map_err(|e| e.to_string())?.0 as isize;

    {
        let mut drag_states = get_dragging_states().lock().unwrap();
        drag_states.insert(hwnd_ptr, true);
    }

    let state_arc = state.0.clone();
    let _ = app.run_on_main_thread(move || {
        let mut state_guard = state_arc.lock().unwrap();
        if let Some(data) = state_guard.get_mut(&label) {
            if let Some(visual) = data.visuals.get(&widget_id) {
                let _ = visual.SetIsVisible(false);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_change_region(
    app: AppHandle,
    label: String,
    widget_id: String,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    border_radius: f32,
    state: State<'_, SharedWidgetState>,
) -> Result<(), String> {
    let window = app.get_webview_window(&label).ok_or("Window not found")?;
    let hwnd_ptr = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
    let scale_factor = window.scale_factor().unwrap_or(1.0) as f32;

    let phys_x = x;
    let phys_y = y;
    let phys_w = width;
    let phys_h = height;
    let phys_radius = border_radius;

    {
        let mut drag_states = get_dragging_states().lock().unwrap();
        drag_states.insert(hwnd_ptr, false);
    }

    let rect = RECT {
        left: phys_x as i32,
        top: phys_y as i32,
        right: (phys_x + phys_w) as i32,
        bottom: (phys_y + phys_h) as i32,
    };

    {
        let mut map = get_regions().lock().unwrap();
        if let Some(rects) = map.get_mut(&hwnd_ptr) {
            rects.insert(widget_id.clone(), rect);
        }
    }

    {
        let mut layout_state = get_layout_state().lock().unwrap();
        if let Some(region) = layout_state.regions.get_mut(&widget_id) {
            region.x = x;
            region.y = y;
            region.width = width;
            region.height = height;
            region.border_radius = border_radius;
        }
    }

    let state_arc = state.0.clone();
    let _ = app.run_on_main_thread(move || {
        let mut state_guard = state_arc.lock().unwrap();
        if let Some(data) = state_guard.get_mut(&label) {
            if let Some(visual) = data.visuals.get(&widget_id) {
                let _ = visual.SetSize(Vector2 {
                    X: phys_w,
                    Y: phys_h,
                });
                let _ = visual.SetOffset(Vector3 {
                    X: phys_x,
                    Y: phys_y,
                    Z: 0.0,
                });

                if let Ok(geometry) = data.compositor.CreateRoundedRectangleGeometry() {
                    let _ = geometry.SetCornerRadius(Vector2 {
                        X: phys_radius,
                        Y: phys_radius,
                    });
                    let _ = geometry.SetSize(Vector2 {
                        X: phys_w,
                        Y: phys_h,
                    });
                    if let Ok(clip) = data.compositor.CreateGeometricClipWithGeometry(&geometry) {
                        let _ = visual.SetClip(&clip);
                    }
                }

                let _ = visual.SetIsVisible(true);
            }
        }
    });

    Ok(())
}
