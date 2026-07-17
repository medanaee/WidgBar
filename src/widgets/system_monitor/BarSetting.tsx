import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';

function SettingCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

export default function SystemMonitorBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const showLabelsBar = config.showLabelsBar ?? false;
    const fillIndicatorsBar = config.fillIndicatorsBar ?? false;
    const showChartsBar = config.showChartsBar ?? false;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            {/* Click to Open Details */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to Open Details</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow clicking the system monitor in the bar to open the popup</p>
                </div>
                <Switch 
                    checked={!config.disableClickPopup} 
                    onCheckedChange={(checked) => handleUpdate({ disableClickPopup: !checked })} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Resource Labels</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Write resource types next to metrics (e.g. CPU 25%)</p>
                </div>
                <Switch 
                    checked={showLabelsBar} 
                    onCheckedChange={(checked) => handleUpdate({ showLabelsBar: checked })} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Fill Background Indicator</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Fill the metric card background as a percentage progress bar</p>
                </div>
                <Switch 
                    checked={fillIndicatorsBar} 
                    onCheckedChange={(checked) => handleUpdate({ fillIndicatorsBar: checked })} 
                />
            </SettingCard>

            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1 mt-4">Mini Charts (Large Bar)</h4>
            
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">CPU Mini Chart</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Show CPU history sparkline in the bar</p>
                </div>
                <Switch 
                    checked={config.showCpuChartBar ?? config.showChartsBar ?? false} 
                    onCheckedChange={(checked) => handleUpdate({ showCpuChartBar: checked })} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">RAM Mini Chart</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Show RAM history sparkline in the bar</p>
                </div>
                <Switch 
                    checked={config.showRamChartBar ?? config.showChartsBar ?? false} 
                    onCheckedChange={(checked) => handleUpdate({ showRamChartBar: checked })} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Disk Mini Chart</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Show Disk history sparkline in the bar</p>
                </div>
                <Switch 
                    checked={config.showDiskChartBar ?? config.showChartsBar ?? false} 
                    onCheckedChange={(checked) => handleUpdate({ showDiskChartBar: checked })} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Network Mini Chart</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Show Network history sparkline in the bar</p>
                </div>
                <Switch 
                    checked={config.showNetChartBar ?? config.showChartsBar ?? false} 
                    onCheckedChange={(checked) => handleUpdate({ showNetChartBar: checked })} 
                />
            </SettingCard>
        </div>
    );
}
