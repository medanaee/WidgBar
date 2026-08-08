import { useEffect } from 'react';
import { LocalLanguage16Regular, LocalLanguage20Regular } from '@fluentui/react-icons';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { useTranslation } from '../../lib/i18n';

export default function TranslateBar({ widgetId }: { widgetId: string }) {
  const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
  const settings = useSettingsStore(state => state.settings) || {};
  const updateConstraints = useUpdateWidgetConstraints(widgetId);
  const { t } = useTranslation();

  const hideLabel = config.barHideLabel === true;
  const label = (config.barLabel as string | undefined)?.trim() || t('widgetTranslate');
  const barHeight = settings.barHeight || 36;
  const isLarge = barHeight >= 48;
  const Icon = isLarge ? LocalLanguage20Regular : LocalLanguage16Regular;

  useEffect(() => {
    updateConstraints({ squareInBar: hideLabel });
  }, [hideLabel, updateConstraints]);

  return (
    <div
      className={`text-zinc-800 dark:text-zinc-100 font-medium tracking-wide flex items-center select-none text-[11px] ${
        isLarge && !hideLabel ? 'flex-col gap-0.5' : 'flex-row gap-1'
      }`}
    >
      <Icon />
      {!hideLabel && <span className="leading-none truncate max-w-28">{label}</span>}
    </div>
  );
}
