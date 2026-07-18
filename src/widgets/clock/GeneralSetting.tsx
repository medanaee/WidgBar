import { useState } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { getAllTimezones } from 'countries-and-timezones';
import { getFlagEmoji } from './Flag';
import { ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Button } from '../../components/ui/button';

function TimezoneSelect({ value, onChange, timeZones }: { value: string, onChange: (val: string) => void, timeZones: any[] }) {
    const [open, setOpen] = useState(false);

    const selectedTz = timeZones.find((t) => t.value === value);
    const selectedLabel = selectedTz ? selectedTz.label : 'Select timezone...';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-56 h-8 text-xs bg-transparent border-zinc-500/20 hover:bg-zinc-500/10 justify-between px-3 font-normal"
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                    <CommandInput placeholder="Search timezone..." />
                    <CommandList className="max-h-[250px]">
                        <CommandEmpty>No timezone found.</CommandEmpty>
                        <CommandGroup>
                            {timeZones.map((tz) => (
                                <CommandItem
                                    key={tz.value}
                                    value={tz.label}
                                    onSelect={() => {
                                        onChange(tz.value);
                                        setOpen(false);
                                    }}
                                    className="text-xs cursor-pointer"
                                    data-checked={tz.value === value}
                                >
                                    <span>{tz.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function ClockGeneralSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    // Get all standard IANA timezones and build the list
    const rawTimezones = getAllTimezones();
    const allTzList = Object.values(rawTimezones)
        .filter(tz => !tz.aliasOf) // Filter out aliases to keep the list clean
        .map(tz => {
            const flag = getFlagEmoji(tz.name);
            const offsetStr = tz.utcOffsetStr;
            return {
                value: tz.name,
                label: `${flag} ${tz.name} (UTC${offsetStr})`
            };
        });

    // Sort alphabetically by name
    allTzList.sort((a, b) => a.value.localeCompare(b.value));

    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localFlag = getFlagEmoji(localTz);

    const timeZones = [
        { value: localTz, label: `${localFlag} Local Time (${localTz})` },
        ...allTzList.filter(tz => tz.value !== localTz)
    ];

    return (
        <div className="space-y-3 pt-2">
            {/* Timezone */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Timezone</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Select the timezone for this clock</p>
                </div>
                <TimezoneSelect 
                    value={timeZone} 
                    onChange={(val) => handleUpdate({ timeZone: val })} 
                    timeZones={timeZones} 
                />
            </div>
        </div>
    );
}
