import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useTranslation, TranslationKey } from '../../lib/i18n';

const CALENDARS = [
    { value: 'gregory', label: 'Gregorian' },
    { value: 'persian', label: 'Solar Persian' },
    { value: 'islamic-umalqura', label: 'Lunar Islamic' },
    { value: 'hebrew', label: 'Hebrew' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'buddhist', label: 'Buddhist' },
    { value: 'indian', label: 'Indian' }
];

const CALENDAR_KEYS: Record<string, string> = {
    'gregory': 'calGregory',
    'persian': 'calPersian',
    'islamic-umalqura': 'calIslamic',
    'hebrew': 'calHebrew',
    'chinese': 'calChinese',
    'buddhist': 'calBuddhist',
    'indian': 'calIndian'
};

export default function CalendarGeneralSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { t } = useTranslation();

    const mainCalendar = config.mainCalendar || 'gregory';
    const secondaryCalendars = config.secondaryCalendars || []; // Array of calendar keys

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    const handleToggleSecondary = (calValue: string, checked: boolean) => {
        let newList = [...secondaryCalendars];
        if (checked) {
            if (newList.length >= 3) {
                // Limit reached
                return;
            }
            if (!newList.includes(calValue)) {
                newList.push(calValue);
            }
        } else {
            newList = newList.filter(item => item !== calValue);
        }
        handleUpdate({ secondaryCalendars: newList });
    };

    return (
        <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Main Calendar Type */}
            <SettingCard>
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Main Calendar</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Select the primary calendar system</p>
                </div>
                <Select value={mainCalendar} onValueChange={(val) => {
                    // Remove it from secondary calendars if selected as main
                    const filteredSecondary = secondaryCalendars.filter((c: string) => c !== val);
                    handleUpdate({ mainCalendar: val, secondaryCalendars: filteredSecondary });
                }}>
                    <SelectTrigger className="w-56 h-8 text-xs bg-transparent border-zinc-500/20">
                        <SelectValue placeholder="Select calendar" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {CALENDARS.map(cal => (
                                <SelectItem key={cal.value} value={cal.value} className="text-xs">
                                    {t(CALENDAR_KEYS[cal.value] as TranslationKey)}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingCard>

            {/* Secondary Calendars List */}
            <div className="space-y-2">
                <div className="px-1">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Secondary Calendars</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Select up to 3 minor calendars to display underneath (Detail view only)</p>
                </div>
                
                <div className="space-y-2">
                    {CALENDARS.filter(cal => cal.value !== mainCalendar).map(cal => {
                        const isChecked = secondaryCalendars.includes(cal.value);
                        const isMaxReached = secondaryCalendars.length >= 3 && !isChecked;

                        return (
                            <SettingCard key={cal.value}>
                                <div>
                                    <h4 className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                        {t(CALENDAR_KEYS[cal.value] as TranslationKey)}
                                    </h4>
                                </div>
                                <Switch 
                                    checked={isChecked} 
                                    disabled={isMaxReached}
                                    onCheckedChange={(checked) => handleToggleSecondary(cal.value, checked)} 
                                />
                            </SettingCard>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
