import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export default function CalendarWidgetSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const showDayOfWeek = config.showDayOfWeek ?? true;
    const showYear = config.showYear ?? true;
    const monthFormat = config.monthFormat || 'text';
    const defaultMode = config.defaultMode || 'detail';
    const showEvents = config.showEvents ?? false;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Show Day of Week */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Day of Week</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display the day name (e.g. Saturday)</p>
                </div>
                <Switch 
                    checked={showDayOfWeek} 
                    onCheckedChange={(checked) => handleUpdate({ showDayOfWeek: checked })} 
                />
            </SettingCard>

            {/* Show Year */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Year</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display the calendar year</p>
                </div>
                <Switch 
                    checked={showYear} 
                    onCheckedChange={(checked) => handleUpdate({ showYear: checked })} 
                />
            </SettingCard>

            {/* Show Events */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Daily Events</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Show upcoming holidays and personal events</p>
                </div>
                <Switch 
                    checked={showEvents} 
                    onCheckedChange={(checked) => handleUpdate({ showEvents: checked })} 
                />
            </SettingCard>

            {/* Month Format */}
            <SettingCard>
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Month Format</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose between text (e.g. July) or numeric (e.g. 7)</p>
                </div>
                <Select value={monthFormat} onValueChange={(val) => handleUpdate({ monthFormat: val })}>
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

            {/* Default Area View Mode */}
            <SettingCard>
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default View Mode</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">The default view for the desktop Area widget</p>
                </div>
                <Select value={defaultMode} onValueChange={(val) => handleUpdate({ defaultMode: val })}>
                    <SelectTrigger className="w-32 h-8 text-xs bg-transparent border-zinc-500/20">
                        <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="detail" className="text-xs">Detail View</SelectItem>
                            <SelectItem value="grid" className="text-xs">Monthly Grid</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingCard>
        </div>
    );
}
