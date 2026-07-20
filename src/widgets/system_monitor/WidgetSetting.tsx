import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useTranslation } from '../../lib/i18n';

export default function SystemMonitorWidgetSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { t, language } = useTranslation();

    const showChartsArea = config.showChartsArea ?? true;
    const areaLayout = (config.areaLayout as 'normal' | 'compact') || 'compact';

    const handleUpdate = (updates: Record<string, unknown>) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('sysMonAreaLayout')}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('sysMonAreaLayoutDesc')}</p>
                </div>
                <Select
                    value={areaLayout}
                    onValueChange={(val) => handleUpdate({ areaLayout: val })}
                >
                    <SelectTrigger className="w-32 h-8 text-xs bg-transparent" dir={language === 'fa' ? 'rtl' : 'ltr'}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={language === 'fa' ? 'rtl' : 'ltr'}>
                        <SelectGroup>
                            <SelectItem value="normal" className="text-xs">{t('sysMonLayoutNormal')}</SelectItem>
                            <SelectItem value="compact" className="text-xs">{t('sysMonLayoutCompact')}</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show History Charts</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display mini graphs for resource utilization history</p>
                </div>
                <Switch 
                    checked={showChartsArea} 
                    onCheckedChange={(checked) => handleUpdate({ showChartsArea: checked })} 
                />
            </SettingCard>
        </div>
    );
}
