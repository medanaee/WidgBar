import { create } from 'zustand';
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
  // Hardcoded built-in widget types initialized directly in memory
  registry: {
    clock: {
      type_name: 'clock',
      icon: 'ClockColor',
      description: 'A simple minimalist digital clock with date.',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 300,
      default_height: 150
    },
    todo: {
      type_name: 'todo',
      icon: 'ClipboardTaskColor',
      description: 'A simple minimalist to-do list for testing.',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 250,
      default_height: 300
    },
    calendar: {
      type_name: 'calendar',
      icon: 'CalendarColor',
      description: 'A simple calendar grid for testing.',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 280,
      default_height: 250
    },
    timer: {
      type_name: 'timer',
      icon: 'ClockAlarmColor',
      description: 'A simple timer for testing.',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 200,
      default_height: 150
    },
    ai: {
      type_name: 'ai',
      icon: 'MagicWandColor',
      description: 'AI chat widget.',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 350,
      default_height: 400
    }
  },
  isLoading: false,

  fetchRegistry: async () => {
    // No-op: Registry is initialized in-memory on startup
  },

  registerWidgetType: (config, sync = true) => {
    set((state) => ({
      registry: { ...state.registry, [config.type_name]: config }
    }));
    
    if (sync) {
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
