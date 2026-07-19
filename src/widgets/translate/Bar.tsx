import { LocalLanguage16Regular, LocalLanguage20Regular } from '@fluentui/react-icons';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../lib/i18n';

export default function TranslateBar({ widgetId: _widgetId }: { widgetId: string }) {
  const settings = useSettingsStore(state => state.settings) || {};
  const barHeight = settings.barHeight || 36;
  const isLarge = barHeight >= 48;
  const { t } = useTranslation();

  const Icon = isLarge ? LocalLanguage20Regular : LocalLanguage16Regular;

  return (
    <div className="text-zinc-800 dark:text-zinc-100 text-sm font-medium tracking-wide flex items-center gap-1.5 select-none">
      <Icon />
      <span className={isLarge ? 'text-sm' : 'text-xs'}>{t('widgetTranslate')}</span>
    </div>
  );
}
