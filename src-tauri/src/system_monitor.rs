use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use sysinfo::{System, Disks, Networks, Components};
use tauri::{State};

#[derive(serde::Serialize, Clone, Debug, Default)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub ram_used_mb: f32,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub gpu_usage: f32,
    pub gpu_temp: f32,
    pub ram_usage: f32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub disk_usage: f32,
    pub disk_used_gb: f32,
    pub disk_total_gb: f32,
    pub net_upload_kb: f32,
    pub net_download_kb: f32,
    pub top_cpu_processes: Vec<ProcessInfo>,
    pub top_ram_processes: Vec<ProcessInfo>,
}

impl Default for SystemStats {
    fn default() -> Self {
        Self {
            cpu_usage: 0.0,
            gpu_usage: 0.0,
            gpu_temp: 0.0,
            ram_usage: 0.0,
            ram_used_gb: 0.0,
            ram_total_gb: 0.0,
            disk_usage: 0.0,
            disk_used_gb: 0.0,
            disk_total_gb: 0.0,
            net_upload_kb: 0.0,
            net_download_kb: 0.0,
            top_cpu_processes: Vec::new(),
            top_ram_processes: Vec::new(),
        }
    }
}

pub struct SystemMonitorState {
    pub stats: Arc<Mutex<SystemStats>>,
}

pub fn start_monitor_thread(state: Arc<Mutex<SystemStats>>) {
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        let mut disks = Disks::new_with_refreshed_list();
        let mut networks = Networks::new_with_refreshed_list();
        let mut components = Components::new_with_refreshed_list();
        
        let mut last_net_check = Instant::now();
        let mut prev_recv_bytes: u64 = networks.iter().map(|(_, net)| net.total_received()).sum();
        let mut prev_trans_bytes: u64 = networks.iter().map(|(_, net)| net.total_transmitted()).sum();

        #[cfg(target_os = "windows")]
        let mut nvml_instance = nvml_wrapper::Nvml::init().ok();

        loop {
            std::thread::sleep(Duration::from_millis(1000));
            
            // Refresh CPU, Memory, Processes, Components
            sys.refresh_cpu();
            sys.refresh_memory();
            sys.refresh_processes();
            components.refresh();
            
            // Refresh Disks & Networks
            disks.refresh();
            networks.refresh();

            // Calculate CPU
            let cpu_usage = sys.global_cpu_info().cpu_usage();

            // Calculate GPU Temp from Components if exposed (e.g., AMD)
            let mut gpu_temp = components.iter()
                .filter(|c| {
                    let label = c.label().to_lowercase();
                    label.contains("gpu") || label.contains("amd") || label.contains("radeon")
                })
                .map(|c| c.temperature())
                .fold(0.0f32, |acc, temp| if temp > acc { temp } else { acc });

            let mut gpu_usage = 0.0;

            // Use NVML for NVIDIA GPUs if available
            #[cfg(target_os = "windows")]
            {
                if let Some(nvml) = &mut nvml_instance {
                    if let Ok(device) = nvml.device_by_index(0) {
                        if let Ok(util) = device.utilization_rates() {
                            gpu_usage = util.gpu as f32;
                        }
                        if let Ok(temp) = device.temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu) {
                            gpu_temp = temp as f32;
                        }
                    }
                }
            }

            // Calculate RAM
            let total_mem = sys.total_memory() as f32;
            let used_mem = sys.used_memory() as f32;
            let ram_usage = (used_mem / total_mem) * 100.0;
            let ram_used_gb = used_mem / 1024.0 / 1024.0 / 1024.0;
            let ram_total_gb = total_mem / 1024.0 / 1024.0 / 1024.0;

            // Calculate Top CPU and Top RAM Processes
            let procs: Vec<ProcessInfo> = sys.processes().values().map(|p| {
                let name = p.name().to_string();
                let clean_name = if name.ends_with(".exe") {
                    name[..name.len() - 4].to_string()
                } else {
                    name
                };
                ProcessInfo {
                    pid: p.pid().as_u32(),
                    name: clean_name,
                    cpu_usage: p.cpu_usage() / (sys.cpus().len() as f32).max(1.0),
                    ram_used_mb: (p.memory() as f32) / 1024.0 / 1024.0,
                }
            }).collect();

            let mut top_cpu_processes = procs.clone();
            top_cpu_processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
            top_cpu_processes.truncate(5);

            let mut top_ram_processes = procs;
            top_ram_processes.sort_by(|a, b| b.ram_used_mb.partial_cmp(&a.ram_used_mb).unwrap_or(std::cmp::Ordering::Equal));
            top_ram_processes.truncate(5);

            // Calculate Disk (Main drive, e.g. C: on Windows or root /)
            let mut disk_used_gb = 0.0;
            let mut disk_total_gb = 0.0;
            let mut disk_usage = 0.0;

            if let Some(main_disk) = disks.iter().find(|d| {
                #[cfg(target_os = "windows")]
                {
                    d.mount_point().to_str().map_or(false, |s| s.starts_with("C:"))
                }
                #[cfg(not(target_os = "windows"))]
                {
                    d.mount_point().to_str() == Some("/")
                }
            }) {
                let total = main_disk.total_space() as f32;
                let free = main_disk.available_space() as f32;
                let used = total - free;
                disk_used_gb = used / 1024.0 / 1024.0 / 1024.0;
                disk_total_gb = total / 1024.0 / 1024.0 / 1024.0;
                disk_usage = (used / total) * 100.0;
            } else if let Some(first_disk) = disks.first() {
                let total = first_disk.total_space() as f32;
                let free = first_disk.available_space() as f32;
                let used = total - free;
                disk_used_gb = used / 1024.0 / 1024.0 / 1024.0;
                disk_total_gb = total / 1024.0 / 1024.0 / 1024.0;
                disk_usage = (used / total) * 100.0;
            }

            // Calculate Network Speed
            let now = Instant::now();
            let elapsed = now.duration_since(last_net_check).as_secs_f32();
            last_net_check = now;

            let current_recv_bytes: u64 = networks.iter().map(|(_, net)| net.total_received()).sum();
            let current_trans_bytes: u64 = networks.iter().map(|(_, net)| net.total_transmitted()).sum();

            let rx_bytes = current_recv_bytes.saturating_sub(prev_recv_bytes);
            let tx_bytes = current_trans_bytes.saturating_sub(prev_trans_bytes);

            prev_recv_bytes = current_recv_bytes;
            prev_trans_bytes = current_trans_bytes;

            let net_download_kb = if elapsed > 0.0 {
                (rx_bytes as f32 / 1024.0) / elapsed
            } else {
                0.0
            };
            let net_upload_kb = if elapsed > 0.0 {
                (tx_bytes as f32 / 1024.0) / elapsed
            } else {
                0.0
            };

            // Update state
            if let Ok(mut lock) = state.lock() {
                *lock = SystemStats {
                    cpu_usage,
                    gpu_usage,
                    gpu_temp,
                    ram_usage,
                    ram_used_gb,
                    ram_total_gb,
                    disk_usage,
                    disk_used_gb,
                    disk_total_gb,
                    net_upload_kb,
                    net_download_kb,
                    top_cpu_processes,
                    top_ram_processes,
                };
            }
        }
    });
}

#[tauri::command]
pub fn get_system_stats(state: State<'_, SystemMonitorState>) -> Result<SystemStats, String> {
    if let Ok(lock) = state.stats.lock() {
        Ok(lock.clone())
    } else {
        Err("Failed to lock system stats".to_string())
    }
}
