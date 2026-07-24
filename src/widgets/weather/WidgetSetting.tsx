import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';

export default function WeatherWidgetSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const showForecast = config.showForecast ?? true;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Forecast</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Enable weather forecast inside the widget (when size permits)</p>
                </div>
                <Switch 
                    checked={showForecast} 
                    onCheckedChange={(checked) => handleUpdate({ showForecast: checked })} 
                />
            </SettingCard>
        </div>
    );
}
