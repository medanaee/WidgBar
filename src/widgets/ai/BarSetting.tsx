import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { SettingCard, SettingCardNoLayout } from '../../components/ui/SettingCard';
import { useTranslation } from '../../lib/i18n';

export default function AiBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { t } = useTranslation();

    const handleUpdate = (updates: Record<string, unknown>) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    const hideLabel = config.barHideLabel === true;
    const barLabel = (config.barLabel as string | undefined) ?? '';

    return (
        <div className="space-y-3 pt-2">
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('barHideLabel')}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('barHideLabelDesc')}</p>
                </div>
                <Switch
                    checked={hideLabel}
                    onCheckedChange={(checked) => handleUpdate({ barHideLabel: checked })}
                />
            </SettingCard>

            {!hideLabel && (
                <SettingCardNoLayout className="flex flex-col gap-2">
                    <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('barCustomLabel')}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('barCustomLabelDesc')}</p>
                    </div>
                    <Input
                        value={barLabel}
                        placeholder={t('widgetAi')}
                        onChange={(e) => handleUpdate({ barLabel: e.target.value })}
                    />
                </SettingCardNoLayout>
            )}

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to Open</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow clicking the AI icon in the bar to open the chat popup</p>
                </div>
                <Switch
                    checked={!config.disableClickPopup}
                    onCheckedChange={(checked) => handleUpdate({ disableClickPopup: !checked })}
                />
            </SettingCard>
        </div>
    );
}
