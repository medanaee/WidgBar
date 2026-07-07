import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { LayoutsRecord, LayoutData, BarHeight } from '../types/layout';


interface LayoutState {
  layouts: LayoutsRecord;
  currentLayout: string;
  isLoading: boolean;
  error: string | null;
  hasInitialized: boolean;
  // Actions
  setLayouts: (layouts: LayoutsRecord, sync?: boolean) => void;
  setCurrentLayout: (layoutName: string, sync?: boolean) => void;
  fetchAndSyncLayouts: () => Promise<void>;
  updateWidget: (monitorId: string, widgetId: string, updates: Partial<DesktopWidget>, sync?: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layouts: {},
  currentLayout: 'default',
  isLoading: false,
  error: null,
  hasInitialized: false,

  setLayouts: (layouts, sync = true) => {
    set({ layouts });
    if (sync) {
      const currentLayout = get().currentLayout;
      const data = layouts[currentLayout];
      if (data) {
        invoke('save_layout', { layoutName: currentLayout, data: JSON.stringify(data) }).catch(console.error);
      }
      emit('store-sync', { layouts, currentLayout }).catch(console.error);
    }
  },

  setCurrentLayout: (currentLayout, sync = true) => {
    set({ currentLayout });
    if (sync) {
      emit('store-sync', { layouts: get().layouts, currentLayout }).catch(console.error);
    }
  },

  updateWidget: (monitorId, widgetId, updates, sync = true) => {
    const currentLayout = get().currentLayout;
    const layouts = { ...get().layouts };
    if (!layouts[currentLayout]) return;
    
    const monitors = [...layouts[currentLayout].monitors];
    const monitorIndex = monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;
    
    const widgetArea = [...monitors[monitorIndex].widgetArea];
    const widgetIndex = widgetArea.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return;
    
    widgetArea[widgetIndex] = { ...widgetArea[widgetIndex], ...updates };
    monitors[monitorIndex] = { ...monitors[monitorIndex], widgetArea };
    layouts[currentLayout] = { ...layouts[currentLayout], monitors };
    
    get().setLayouts(layouts, sync);
  },



  fetchAndSyncLayouts: async () => {
    set({ isLoading: true, error: null });
    try {
      // Invoke the Rust command to init and get all rows
      const rawData = await invoke<Record<string, string>>('load_all_layouts');
      
      const parsedLayouts: LayoutsRecord = {};
      
      // Parse the stringified JSON data columns coming from SQLite
      Object.entries(rawData).forEach(([layoutName, jsonString]) => {
        try {
          const parsedJson = JSON.parse(jsonString);
          
          if (parsedJson.monitors && Array.isArray(parsedJson.monitors)) {
            parsedJson.monitors = parsedJson.monitors.map((m: any) => {
              if (m.bar && !m.barSections) {
                m.barSections = [
                  {
                    id: 'section_legacy',
                    name: 'Main Section',
                    widgets: m.bar,
                    widgetSpacing: 8
                  }
                ];
                delete m.bar;
              }
              m.barJustify = m.barJustify || 'space-between';
              m.barSectionSpacing = m.barSectionSpacing ?? 16;
              m.showMainWindowButton = m.showMainWindowButton ?? true;
              m.barSeparator = m.barSeparator || 'none';
              if (!m.barSections) m.barSections = [];
              m.barSections = m.barSections.map((s: any) => {
                s.widgetSpacing = s.widgetSpacing ?? 8;
                return s;
              });
              return m;
            });
          }

          parsedLayouts[layoutName] = {
            monitors: parsedJson.monitors || []
          };
        } catch (parseError) {
          console.error(`Failed to parse JSON string for layout: ${layoutName}`, parseError);
          parsedLayouts[layoutName] = { monitors: [] };
        }
      });

      // If 'default' layout does not exist, create it
      if (!parsedLayouts['default']) {
        parsedLayouts['default'] = { monitors: [] };
        invoke('save_layout', { layoutName: 'default', data: JSON.stringify(parsedLayouts['default']) }).catch(console.error);
      }

      set({ layouts: parsedLayouts, isLoading: false, hasInitialized: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      set({ error: errorMessage, isLoading: false });
      console.error('Error fetching layouts from tauri backend:', errorMessage);
    }
  }
}));

// Listen for sync events from other windows
listen('store-sync', (event: any) => {
  const { layouts, currentLayout } = event.payload;
  if (layouts) {
    useLayoutStore.getState().setLayouts(layouts, false);
  }
  if (currentLayout) {
    useLayoutStore.getState().setCurrentLayout(currentLayout, false);
  }
}).catch(console.error);