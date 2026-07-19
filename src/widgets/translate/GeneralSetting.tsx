import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { useTranslation } from '../../lib/i18n';
import TranslateEngineSettingsFields from './TranslateEngineSettingsFields';
import { TranslateEngineConfig } from '../../lib/TranslateCore';
import { TranslateTone } from './languages';

export default function TranslateGeneralSetting({ widgetId }: { widgetId: string }) {
  const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
  const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
  const { t } = useTranslation();

  const override = config.overrideTranslateDefaults ?? false;

  const handleUpdate = (updates: Record<string, unknown>) => {
    const current = useWidgetInstanceStore.getState().instances[widgetId] || {};
    updateInstance(widgetId, { ...current, ...updates });
  };

  const engine: TranslateEngineConfig = {
    useAi: config.useAi ?? false,
    aiInstanceId: config.aiInstanceId,
    aiModel: config.aiModel,
    tone: (config.tone as TranslateTone) || 'default',
  };

  return (
    <div className="space-y-3 pt-2">
      <SettingCard>
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {t('translateOverride')}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t('translateOverrideDesc')}
          </p>
        </div>
        <Switch
          checked={override}
          onCheckedChange={(checked) => handleUpdate({ overrideTranslateDefaults: checked })}
        />
      </SettingCard>

      {override && (
        <TranslateEngineSettingsFields
          value={engine}
          onChange={(updates) => handleUpdate(updates)}
        />
      )}
    </div>
  );
}
