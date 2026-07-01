import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

interface WidgetInstanceState {
  instances: Record<string, any>;
  isLoading: boolean;
  
  fetchInstances: () => Promise<void>;
  updateInstance: (id: string, data: any, sync?: boolean) => void;
  deleteInstance: (id: string, sync?: boolean) => void;
}

export const useWidgetInstanceStore = create<WidgetInstanceState>((set, get) => ({
  instances: {},
  isLoading: false,

  fetchInstances: async () => {
    set({ isLoading: true });
    try {
      const rawData = await invoke<Record<string, string>>('load_widget_instances');
      const parsed: Record<string, any> = {};
      
      Object.entries(rawData).forEach(([id, jsonString]) => {
        try {
          parsed[id] = JSON.parse(jsonString);
        } catch (e) {
          console.error(`Failed to parse widget instance for ${id}`);
        }
      });
      set({ instances: parsed, isLoading: false });
    } catch (error) {
      console.error('Failed to load widget instances:', error);
      set({ isLoading: false });
    }
  },

  updateInstance: (id, data, sync = true) => {
    set((state) => ({
      instances: { ...state.instances, [id]: data }
    }));
    
    if (sync) {
      invoke('save_widget_instance_settings', { 
        id, 
        data: JSON.stringify(data) 
      }).catch(console.error);
      emit('widget-instance-sync', { id, data }).catch(console.error);
    }
  },

  deleteInstance: (id, sync = true) => {
    set((state) => {
      const newInstances = { ...state.instances };
      delete newInstances[id];
      return { instances: newInstances };
    });
    
    if (sync) {
      invoke('delete_widget_instance', { id }).catch(console.error);
      emit('widget-instance-delete', { id }).catch(console.error);
    }
  }
}));

listen('widget-instance-sync', (event: any) => {
  const { id, data } = event.payload;
  if (id && data) {
    useWidgetInstanceStore.getState().updateInstance(id, data, false);
  }
}).catch(console.error);

listen('widget-instance-delete', (event: any) => {
  const { id } = event.payload;
  if (id) {
    useWidgetInstanceStore.getState().deleteInstance(id, false);
  }
}).catch(console.error);
