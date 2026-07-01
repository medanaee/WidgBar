import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

export interface WidgetTypeConfig {
  type_name: string;
  icon: string;
  description?: string;
  can_be_in_bar: boolean;
  can_be_in_area: boolean;
  default_config: any;
  default_width?: number;
  default_height?: number;
}

interface WidgetRegistryState {
  registry: Record<string, WidgetTypeConfig>;
  isLoading: boolean;
  
  fetchRegistry: () => Promise<void>;
  registerWidgetType: (config: WidgetTypeConfig, sync?: boolean) => void;
}

export const useWidgetRegistryStore = create<WidgetRegistryState>((set, get) => ({
  registry: {},
  isLoading: false,

  fetchRegistry: async () => {
    set({ isLoading: true });
    try {
      const rawData = await invoke<Record<string, string>>('load_widget_registry');
      const parsed: Record<string, WidgetTypeConfig> = {};
      
      Object.entries(rawData).forEach(([typeName, jsonString]) => {
        try {
          parsed[typeName] = JSON.parse(jsonString);
        } catch (e) {
          console.error(`Failed to parse widget registry for ${typeName}`);
        }
      });
      set({ registry: parsed, isLoading: false });
    } catch (error) {
      console.error('Failed to load widget registry:', error);
      set({ isLoading: false });
    }
  },

  registerWidgetType: (config, sync = true) => {
    set((state) => ({
      registry: { ...state.registry, [config.type_name]: config }
    }));
    
    if (sync) {
      invoke('save_widget_type_settings', { 
        typeName: config.type_name, 
        data: JSON.stringify(config) 
      }).catch(console.error);
      emit('widget-registry-sync', { config }).catch(console.error);
    }
  }
}));

listen('widget-registry-sync', (event: any) => {
  const { config } = event.payload;
  if (config) {
    useWidgetRegistryStore.getState().registerWidgetType(config, false);
  }
}).catch(console.error);
