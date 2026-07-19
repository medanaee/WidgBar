import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export default function CalendarBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const barShowDayOfWeek = config.barShowDayOfWeek ?? true;
    const barShowYear = config.barShowYear ?? true;
    const barMonthFormat = config.barMonthFormat || 'text';

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Show Day of Week in Bar */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Day of Week</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display the day name</p>
                </div>
                <Switch 
                    checked={barShowDayOfWeek} 
                    onCheckedChange={(checked) => handleUpdate({ barShowDayOfWeek: checked })} 
                />
            </SettingCard>

            {/* Show Year in Bar */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Year</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display the calendar year</p>
                </div>
                <Switch 
                    checked={barShowYear} 
                    onCheckedChange={(checked) => handleUpdate({ barShowYear: checked })} 
                />
            </SettingCard>

            {/* Month Format in Bar */}
            <SettingCard>
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Month Format</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose between text (e.g. July) or numeric (e.g. 7)</p>
                </div>
                <Select value={barMonthFormat} onValueChange={(val) => handleUpdate({ barMonthFormat: val })}>
                    <SelectTrigger className="w-32 h-8 text-xs bg-transparent border-zinc-500/20">
                        <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="text" className="text-xs">Text (Name)</SelectItem>
                            <SelectItem value="numeric" className="text-xs">Numeric</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingCard>
        </div>
    );
}
