import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';

export default function ClockBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const barShowSeconds = config.barShowSeconds ?? false;
    const barIs24Hour = config.barIs24Hour ?? false;
    const barShowTimezone = config.barShowTimezone ?? false;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            {/* Show Seconds in Bar */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Seconds in Bar</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display seconds hand or digits on the top bar clock</p>
                </div>
                <Switch 
                    checked={barShowSeconds} 
                    onCheckedChange={(checked) => handleUpdate({ barShowSeconds: checked })} 
                />
            </SettingCard>

            {/* 24-Hour Format in Bar */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">24-Hour Format in Bar</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Use 24-hour time instead of AM/PM in the bar clock</p>
                </div>
                <Switch 
                    checked={barIs24Hour} 
                    onCheckedChange={(checked) => handleUpdate({ barIs24Hour: checked })} 
                />
            </SettingCard>

            {/* Show Timezone in Bar */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Timezone in Bar</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display flag and name of selected timezone on the top bar clock</p>
                </div>
                <Switch 
                    checked={barShowTimezone} 
                    onCheckedChange={(checked) => handleUpdate({ barShowTimezone: checked })} 
                />
            </SettingCard>

            {/* Click to Open Details */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to Open Details</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow clicking the clock in the bar to open its settings/details popup</p>
                </div>
                <Switch 
                    checked={!config.disableClickPopup} 
                    onCheckedChange={(checked) => handleUpdate({ disableClickPopup: !checked })} 
                />
            </SettingCard>

        </div>
    );
}
