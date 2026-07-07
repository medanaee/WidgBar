import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';

// Styled Card matching the layout settings card
function SettingCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

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
        </div>
    );
}
