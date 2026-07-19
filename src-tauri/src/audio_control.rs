#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::IMMDeviceEnumerator;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::MMDeviceEnumerator;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::COINIT_APARTMENTTHREADED;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::CoCreateInstance;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::CLSCTX_ALL;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::eRender;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::eConsole;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};



#[cfg(target_os = "windows")]
pub fn set_volume(vol: f32) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;
            
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| e.to_string())?;
            
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
            
        volume.SetMasterVolumeLevelScalar(vol, std::ptr::null())
            .map_err(|e| e.to_string())?;
            
        Ok(())
    }
}

#[cfg(target_os = "windows")]
pub fn get_volume() -> Result<f32, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
            
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;
            
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to activate endpoint volume: {}", e))?;
            
        let level = volume.GetMasterVolumeLevelScalar()
            .map_err(|e| format!("Failed to get master volume level: {}", e))?;
            
        Ok(level)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_volume(_vol: f32) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn get_volume() -> Result<f32, String> {
    Ok(0.5)
}
