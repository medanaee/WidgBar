import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { NumberInput } from '../../components/ui/NumberInput';
import { SettingCard } from '../../components/ui/SettingCard';
import { useTranslation } from '../../lib/i18n';

export default function ClipboardGeneralSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore((state) => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore((state) => state.updateInstance);
    const maxHistory = useClipboardStore((s) => s.maxHistory);
    const setMaxHistory = useClipboardStore((s) => s.setMaxHistory);
    const { t } = useTranslation();

    const value = config.maxHistory ?? maxHistory ?? 50;

    return (
        <div className="space-y-3 pt-2">
            <SettingCard>
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardMaxHistory')}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('clipboardMaxHistoryDesc')}</p>
                </div>
                <NumberInput
                    min={5}
                    max={200}
                    step={5}
                    value={value}
                    onChange={(val) => {
                        updateInstance(widgetId, { ...config, maxHistory: val });
                        setMaxHistory(val);
                    }}
                />
            </SettingCard>
        </div>
    );
}
