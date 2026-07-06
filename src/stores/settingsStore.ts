import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { BarHeight, Theme, Settings } from '../types/layout';

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'en',
  barHeight: BarHeight.Medium,
  snapMargin: 16,
  barAnimate: true,
  widgetBgOpacity: 80,
};

interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  hasInitialized: boolean;
  updateSettings: (settings: Partial<Settings>) => void;
  fetchAndSyncSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  hasInitialized: false,

    updateSettings: async (newSettings) => {
    const currentSettings = get().settings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    set({ settings: updatedSettings });
    
    invoke('save_global_settings', { data: JSON.stringify(updatedSettings) }).catch(console.error);
    emit('settings-sync', updatedSettings).catch(console.error);

    // If barHeight changed, dynamically update all existing bars
    if (newSettings.barHeight !== undefined && newSettings.barHeight !== currentSettings.barHeight) {
      try {
        const backendState = await invoke<any>('get_layout');
        if (backendState && backendState.bars) {
          for (const barId of Object.keys(backendState.bars)) {
            await invoke('update_bar_height', { id: barId, height: newSettings.barHeight }).catch(console.error);
          }
        }
      } catch (err) {
        console.error('Failed to update bar heights dynamically:', err);
      }
    }
  },

  fetchAndSyncSettings: async () => {
    set({ isLoading: true });
    try {
      const rawData = await invoke<string>('load_global_settings');
      let parsedSettings = DEFAULT_SETTINGS;
      if (rawData && rawData !== '{}') {
        parsedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(rawData) };
      }
      set({ settings: parsedSettings, isLoading: false, hasInitialized: true });
    } catch (err) {
      console.error('Error fetching global settings from tauri backend:', err);
      set({ isLoading: false });
    }
  }
}));

listen('settings-sync', (event: any) => {
  const updatedSettings = event.payload;
  if (updatedSettings) {
    useSettingsStore.setState({ settings: updatedSettings });
  }
}).catch(console.error);
