import { create } from 'zustand';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// ── Hardcoded metadata (never persisted, always from code) ──
export interface WidgetTypeMeta {
  type_name: string;
  icon: string;
  nameKey: string;
  descriptionKey?: string;
  can_be_in_bar: boolean;
  can_be_in_area: boolean;
}

export const WIDGET_TYPE_META: Record<string, WidgetTypeMeta> = {
  clock: {
    type_name: 'clock',
    icon: 'ClockColor',
    nameKey: 'widgetClock',
    descriptionKey: 'widgetClockDesc',
    can_be_in_bar: true,
    can_be_in_area: true,
  },
  ai: {
    type_name: 'ai',
    icon: 'BotSparkleColor',
    nameKey: 'widgetAi',
    descriptionKey: 'widgetAiDesc',
    can_be_in_bar: true,
    can_be_in_area: true,
  },
  weather: {
    type_name: 'weather',
    icon: 'WeatherPartlyCloudyDayRegular',
    nameKey: 'widgetWeather',
    descriptionKey: 'widgetWeatherDesc',
    can_be_in_bar: true,
    can_be_in_area: true,
  },
  system_monitor: {
    type_name: 'system_monitor',
    icon: 'DeveloperBoardRegular',
    nameKey: 'widgetSystemMonitor',
    descriptionKey: 'widgetSystemMonitorDesc',
    can_be_in_bar: true,
    can_be_in_area: true,
  }
};

// ── DB-persisted settings per widget type ──
export interface WidgetTypeSettings {
  default_width: number;
  default_height: number;
}

// Seed defaults for first-time DB insertion
const SEED_DEFAULTS: Record<string, WidgetTypeSettings> = {
  clock: { default_width: 300, default_height: 150 },
  ai: { default_width: 350, default_height: 400 },
  weather: { default_width: 300, default_height: 150 },
  system_monitor: { default_width: 300, default_height: 180 },
};

// ── Combined type for consumers ──
export type WidgetTypeConfig = WidgetTypeMeta & WidgetTypeSettings;

interface WidgetRegistryState {
  settings: Record<string, WidgetTypeSettings>;
  isLoading: boolean;

  /** Combined view: meta + settings for each known widget type */
  registry: Record<string, WidgetTypeConfig>;

  fetchRegistry: () => Promise<void>;
  updateWidgetType: (typeName: string, updates: Partial<WidgetTypeSettings>) => void;
}

function buildRegistry(settings: Record<string, WidgetTypeSettings>): Record<string, WidgetTypeConfig> {
  const result: Record<string, WidgetTypeConfig> = {};
  for (const [key, meta] of Object.entries(WIDGET_TYPE_META)) {
    result[key] = {
      ...meta,
      ...(settings[key] || SEED_DEFAULTS[key] || { default_width: 300, default_height: 150 }),
    };
  }
  return result;
}

export const useWidgetRegistryStore = create<WidgetRegistryState>((set, get) => ({
  settings: { ...SEED_DEFAULTS },
  isLoading: false,
  registry: buildRegistry(SEED_DEFAULTS),

  fetchRegistry: async () => {
    set({ isLoading: true });
    try {
      const dbRaw: Record<string, string> = await invoke('load_widget_registry');

      const dbSettings: Record<string, WidgetTypeSettings> = {};
      for (const [key, json] of Object.entries(dbRaw)) {
        try { dbSettings[key] = JSON.parse(json); } catch {}
      }

      // Seed new widget types into DB
      for (const key of Object.keys(WIDGET_TYPE_META)) {
        if (!dbSettings[key]) {
          const seed = SEED_DEFAULTS[key] || { default_width: 300, default_height: 150 };
          await invoke('save_widget_registry', { id: key, data: JSON.stringify(seed) });
          dbSettings[key] = seed;
        }
      }

      // Remove stale widget types from DB
      for (const key of Object.keys(dbSettings)) {
        if (!WIDGET_TYPE_META[key]) {
          await invoke('delete_widget_registry', { id: key });
          delete dbSettings[key];
        }
      }

      set({
        settings: dbSettings,
        registry: buildRegistry(dbSettings),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch widget registry:', error);
      set({ isLoading: false });
    }
  },

  updateWidgetType: (typeName, updates) => {
    const current = get().settings[typeName];
    if (!current) return;

    const updated = { ...current, ...updates };
    const newSettings = { ...get().settings, [typeName]: updated };

    set({
      settings: newSettings,
      registry: buildRegistry(newSettings),
    });

    invoke('save_widget_registry', { id: typeName, data: JSON.stringify(updated) }).catch(console.error);
    emit('widget-registry-sync', { typeName, settings: updated }).catch(console.error);
  },
}));

// Cross-window sync
listen('widget-registry-sync', (event: any) => {
  const { typeName, settings } = event.payload;
  if (typeName && settings) {
    const store = useWidgetRegistryStore.getState();
    const newSettings = { ...store.settings, [typeName]: settings };
    useWidgetRegistryStore.setState({
      settings: newSettings,
      registry: buildRegistry(newSettings),
    });
  }
}).catch(console.error);
