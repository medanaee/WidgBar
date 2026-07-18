import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { VisualSelector } from '../../components/ui/VisualSelector';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

// Styled Card matching the Main layout settings card exactly
function SettingCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

export default function ClockWidgetSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const clockType = config.clockType || 'digital';
    const showSeconds = config.showSeconds ?? false;
    const is24Hour = config.is24Hour ?? false;
    const showTimezone = config.showTimezone ?? false;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    const clockTypeOptions = [
        {
            value: 'digital',
            label: 'Digital',
            preview: (
                <span className="text-zinc-600 dark:text-zinc-300 text-sm font-bold font-sans tracking-tight">12:00</span>
            )
        },
        {
            value: 'analog',
            label: 'Classic',
            preview: (
                <svg viewBox="0 0 40 40" className="w-9 h-9">
                    <circle cx="20" cy="20" r="17" className="fill-none stroke-zinc-500/50 dark:stroke-zinc-400/50" strokeWidth="1.5" />
                    <line x1="20" y1="20" x2="20" y2="9" className="stroke-zinc-500/80 dark:stroke-zinc-300" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="20" y1="20" x2="28" y2="20" className="stroke-zinc-500/80 dark:stroke-zinc-300" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="20" cy="20" r="2.2" className="fill-zinc-600 dark:fill-zinc-200" />
                </svg>
            )
        },
        {
            value: 'analog_macos',
            label: 'macOS',
            preview: (
                <svg viewBox="0 0 40 40" className="w-9 h-9">
                    {Array.from({ length: 12 }).map((_, h) => {
                        const isMajor = h % 3 === 0;
                        const angle = h * 30 * (Math.PI / 180);
                        const len = isMajor ? 3 : 1.5;
                        const x1 = 20 + (18 - len) * Math.sin(angle);
                        const y1 = 20 - (18 - len) * Math.cos(angle);
                        const x2 = 20 + 18 * Math.sin(angle);
                        const y2 = 20 - 18 * Math.cos(angle);
                        return (
                            <line 
                                key={h} 
                                x1={x1} y1={y1} x2={x2} y2={y2} 
                                className={isMajor ? "stroke-zinc-500/80 dark:stroke-zinc-300" : "stroke-zinc-500/30 dark:stroke-zinc-400/20"} 
                                strokeWidth={isMajor ? 1.2 : 0.8} 
                                strokeLinecap="round" 
                            />
                        );
                    })}
                    <line x1="20" y1="20" x2="20" y2="10" className="stroke-zinc-500/80 dark:stroke-zinc-300" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="20" y1="20" x2="28" y2="20" className="stroke-zinc-500/80 dark:stroke-zinc-300" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="20" cy="20" r="1.8" className="fill-zinc-600 dark:fill-zinc-200" />
                </svg>
            )
        }
    ];

    return (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <VisualSelector
                value={clockType}
                onChange={(val) => handleUpdate({ clockType: val })}
                options={clockTypeOptions}
                label="Clock Type"
                description="Choose between digital or analog displays"
            />

            {/* Show Seconds */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Seconds</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display seconds hand or digits</p>
                </div>
                <Switch 
                    checked={showSeconds} 
                    onCheckedChange={(checked) => handleUpdate({ showSeconds: checked })} 
                />
            </SettingCard>

            {/* 24-Hour Format (only applicable for Digital Clock) */}
            {clockType === 'digital' && (
                <div className="">
                    <SettingCard>
                        <div>
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">24-Hour Format</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Use 24-hour time instead of AM/PM</p>
                        </div>
                        <Switch 
                            checked={is24Hour} 
                            onCheckedChange={(checked) => handleUpdate({ is24Hour: checked })} 
                        />
                    </SettingCard>
                </div>
            )}

            {/* Show Timezone */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Timezone</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Display flag and name of selected timezone</p>
                </div>
                <Switch 
                    checked={showTimezone} 
                    onCheckedChange={(checked) => handleUpdate({ showTimezone: checked })} 
                />
            </SettingCard>

            {/* Date Format (only applicable for Digital Clock) */}
            {clockType === 'digital' && (
                <SettingCard>
                    <div className="flex-grow min-w-0 pr-3">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Date Format</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose calendar style or hide date</p>
                    </div>
                    <Select value={config.dateFormat || 'gregorian'} onValueChange={(val) => handleUpdate({ dateFormat: val })}>
                        <SelectTrigger className="w-40 h-8 text-xs bg-transparent border-zinc-500/20">
                            <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="none" className="text-xs">No Date</SelectItem>
                                <SelectItem value="gregorian" className="text-xs">Gregorian</SelectItem>
                                <SelectItem value="jalali" className="text-xs">Solar Persian</SelectItem>
                                <SelectItem value="islamic" className="text-xs">Lunar Islamic</SelectItem>
                                <SelectItem value="buddhist" className="text-xs">Buddhist</SelectItem>
                                <SelectItem value="chinese" className="text-xs">Chinese</SelectItem>
                                <SelectItem value="hebrew" className="text-xs">Hebrew</SelectItem>
                                <SelectItem value="indian" className="text-xs">Indian</SelectItem>
                                <SelectItem value="japanese" className="text-xs">Japanese</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </SettingCard>
            )}
        </div>
    );
}
