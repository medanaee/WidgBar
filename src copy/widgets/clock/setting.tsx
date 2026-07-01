import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export default function ClockSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const showSeconds = config.showSeconds ?? false;
    const is24Hour = config.is24Hour ?? false;

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

    // Ensure current timezone is in the list, otherwise add it
    if (!timeZones.find(tz => tz.value === timeZone)) {
        timeZones.push({ value: timeZone, label: timeZone });
    }

    return (
        <div className="space-y-4 pt-2">
            {/* Timezone */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Timezone</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Select the timezone for this clock</p>
                </div>
                <Select value={timeZone} onValueChange={(val) => handleUpdate({ timeZone: val })}>
                    <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {timeZones.map(tz => (
                                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {/* Show Seconds */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Seconds</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display seconds on the clock</p>
                </div>
                <Switch 
                    checked={showSeconds} 
                    onCheckedChange={(checked) => handleUpdate({ showSeconds: checked })} 
                />
            </div>

            {/* AM/PM Format */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">24-Hour Format</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Use 24-hour time instead of AM/PM</p>
                </div>
                <Switch 
                    checked={is24Hour} 
                    onCheckedChange={(checked) => handleUpdate({ is24Hour: checked })} 
                />
            </div>
        </div>
    );
}
