import { create } from 'zustand';
import { emit, listen } from '@tauri-apps/api/event';

export interface WidgetTypeConfig {
  type_name: string;
  icon: string;
  nameKey: string;
  descriptionKey?: string;
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
  updateWidgetType: (typeName: string, updates: Partial<WidgetTypeConfig>) => void;
}

export const useWidgetRegistryStore = create<WidgetRegistryState>((set, get) => ({
  // Hardcoded built-in widget types initialized directly in memory
  registry: {
    clock: {
      type_name: 'clock',
      icon: 'ClockColor',
      nameKey: 'widgetClock',
      descriptionKey: 'widgetClockDesc',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 300,
      default_height: 150
    },
    ai: {
      type_name: 'ai',
      icon: 'BotSparkleColor',
      nameKey: 'widgetAi',
      descriptionKey: 'widgetAiDesc',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 350,
      default_height: 400
    },
    weather: {
      type_name: 'weather',
      icon: 'WeatherPartlyCloudyDayRegular',
      nameKey: 'widgetWeather',
      descriptionKey: 'widgetWeatherDesc',
      can_be_in_bar: true,
      can_be_in_area: true,
      default_config: {},
      default_width: 300,
      default_height: 150
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
  },

  updateWidgetType: (typeName, updates) => {
    set((state) => {
      const existing = state.registry[typeName];
      if (!existing) return state;
      const updated = { ...existing, ...updates };
      
      // Sync it
      emit('widget-registry-sync', { config: updated }).catch(console.error);
      
      return {
        registry: { ...state.registry, [typeName]: updated }
      };
    });
  }
}));

listen('widget-registry-sync', (event: any) => {
  const { config } = event.payload;
  if (config) {
    useWidgetRegistryStore.getState().registerWidgetType(config, false);
  }
}).catch(console.error);
