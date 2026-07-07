import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export default function ClockGeneralSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    const timeZones = [
        { value: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'Local Time (Default)' },
        { value: 'UTC', label: 'UTC' },
        { value: 'America/New_York', label: 'New York (EST/EDT)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
        { value: 'Europe/London', label: 'London (GMT/BST)' },
        { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
        { value: 'Asia/Tehran', label: 'Tehran (IRST/IRDT)' },
        { value: 'Asia/Dubai', label: 'Dubai (GST)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
        { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    ];

    if (!timeZones.find(tz => tz.value === timeZone)) {
        timeZones.push({ value: timeZone, label: timeZone });
    }

    return (
        <div className="space-y-3 pt-2">
            {/* Timezone */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Timezone</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Select the timezone for this clock</p>
                </div>
                <Select value={timeZone} onValueChange={(val) => handleUpdate({ timeZone: val })}>
                    <SelectTrigger className="w-48 h-8 text-xs bg-transparent border-zinc-500/20">
                        <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {timeZones.map(tz => (
                                <SelectItem key={tz.value} value={tz.value} className="text-xs">{tz.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
