import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { useWidgetInstanceStore } from '../stores/widgetInstanceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { TranslateTone } from '../widgets/translate/languages';
import { translateText } from '../widgets/translate/translateService';

/** App-wide translation engine configuration */
export interface TranslateEngineConfig {
  useAi: boolean;
  aiInstanceId?: string;
  aiModel?: string;
  tone: TranslateTone;
}

const DEFAULT_ENGINE: TranslateEngineConfig = {
  useAi: false,
  tone: 'default',
};

/** Read global defaults from the translate widget type registry */
export function getGlobalTranslateConfig(): TranslateEngineConfig {
  const settings = useWidgetRegistryStore.getState().settings['translate'] || {};
  return {
    useAi: settings.useAi ?? DEFAULT_ENGINE.useAi,
    aiInstanceId: settings.aiInstanceId,
    aiModel: settings.aiModel,
    tone: (settings.tone as TranslateTone) || DEFAULT_ENGINE.tone,
  };
}

/**
 * Resolve engine config for a specific translate widget instance.
 * Uses instance override when enabled; otherwise falls back to global defaults.
 */
export function resolveTranslateConfig(widgetId?: string): TranslateEngineConfig {
  const global = getGlobalTranslateConfig();
  if (!widgetId) return global;

  const instance = useWidgetInstanceStore.getState().instances[widgetId] || {};
  if (!instance.overrideTranslateDefaults) return global;

  return {
    useAi: instance.useAi ?? global.useAi,
    aiInstanceId: instance.aiInstanceId ?? global.aiInstanceId,
    aiModel: instance.aiModel ?? global.aiModel,
    tone: (instance.tone as TranslateTone) || global.tone,
  };
}

export interface RequestTranslateParams {
  text: string;
  sourceLang: string;
  targetLang: string;
  /** When set, uses that widget's override/global resolution */
  widgetId?: string;
  /** One-shot override on top of resolved config */
  configOverride?: Partial<TranslateEngineConfig>;
}

/**
 * Central translation entry-point for the whole app.
 * Any widget/feature can call this with the shared engine defaults.
 */
export async function requestTranslate(params: RequestTranslateParams): Promise<string> {
  const base = resolveTranslateConfig(params.widgetId);
  const config: TranslateEngineConfig = { ...base, ...params.configOverride };
  const uiLang = useSettingsStore.getState().settings?.language || 'en';

  return translateText({
    text: params.text,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    useAi: config.useAi,
    tone: config.tone,
    aiInstanceId: config.aiInstanceId,
    aiModel: config.aiModel,
    uiLang,
  });
}

/** React-friendly selector helpers */
export function selectGlobalTranslateConfig(
  registrySettings: Record<string, { useAi?: boolean; aiInstanceId?: string; aiModel?: string; tone?: string }>
): TranslateEngineConfig {
  const settings = registrySettings['translate'] || {};
  return {
    useAi: settings.useAi ?? DEFAULT_ENGINE.useAi,
    aiInstanceId: settings.aiInstanceId,
    aiModel: settings.aiModel,
    tone: (settings.tone as TranslateTone) || DEFAULT_ENGINE.tone,
  };
}
