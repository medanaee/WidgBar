import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export default function SystemMonitorGeneralSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const enabledMetrics = config.enabledMetrics || ['cpu', 'ram', 'disk', 'net'];

    const toggleMetric = (metric: string, checked: boolean) => {
        let updated = [...enabledMetrics];
        if (checked) {
            if (!updated.includes(metric)) {
                updated.push(metric);
            }
        } else {
            updated = updated.filter(m => m !== metric);
        }
        updateInstance(widgetId, { ...config, enabledMetrics: updated });
    };

    return (
        <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">Enabled Metrics</h4>
            
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">CPU Usage</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor overall CPU utilization</p>
                </div>
                <Switch 
                    checked={enabledMetrics.includes('cpu')} 
                    onCheckedChange={(checked) => toggleMetric('cpu', checked)} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">RAM Usage</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor memory consumption</p>
                </div>
                <Switch 
                    checked={enabledMetrics.includes('ram')} 
                    onCheckedChange={(checked) => toggleMetric('ram', checked)} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Disk Usage</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor main disk utilization</p>
                </div>
                <Switch 
                    checked={enabledMetrics.includes('disk')} 
                    onCheckedChange={(checked) => toggleMetric('disk', checked)} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Network Usage</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor internet upload/download speeds</p>
                </div>
                <Switch 
                    checked={enabledMetrics.includes('net')} 
                    onCheckedChange={(checked) => toggleMetric('net', checked)} 
                />
            </SettingCard>

            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1 mt-4">Display Options</h4>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Network Chart Speed Ceiling</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Baseline maximum scale for the network speed sparkline</p>
                </div>
                <Select 
                    value={String(config.netMaxSpeed || 1024)} 
                    onValueChange={(val) => updateInstance(widgetId, { ...config, netMaxSpeed: Number(val) })}
                >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="256">256 KB/s</SelectItem>
                            <SelectItem value="512">512 KB/s</SelectItem>
                            <SelectItem value="1024">1 MB/s</SelectItem>
                            <SelectItem value="2048">2 MB/s</SelectItem>
                            <SelectItem value="5120">5 MB/s</SelectItem>
                            <SelectItem value="10240">10 MB/s</SelectItem>
                            <SelectItem value="20480">20 MB/s</SelectItem>
                            <SelectItem value="51200">50 MB/s</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show RAM as Used GB</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Toggle between Used GB value and percentage usage</p>
                </div>
                <Switch 
                    checked={config.ramValueType === 'used'} 
                    onCheckedChange={(checked) => updateInstance(widgetId, { ...config, ramValueType: checked ? 'used' : 'percentage' })} 
                />
            </SettingCard>

            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Disk as Used GB</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Toggle between Used GB value and percentage usage</p>
                </div>
                <Switch 
                    checked={config.diskValueType === 'used'} 
                    onCheckedChange={(checked) => updateInstance(widgetId, { ...config, diskValueType: checked ? 'used' : 'percentage' })} 
                />
            </SettingCard>
        </div>
    );
}
