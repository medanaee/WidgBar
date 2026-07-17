import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';

function SettingCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

export default function WeatherBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            {/* Click to Open Details */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to Open Details</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow clicking the weather icon in the bar to open the popup</p>
                </div>
                <Switch 
                    checked={!config.disableClickPopup} 
                    onCheckedChange={(checked) => handleUpdate({ disableClickPopup: !checked })} 
                />
            </SettingCard>

        </div>
    );
}
