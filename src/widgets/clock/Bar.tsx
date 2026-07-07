import React, { useEffect, useState } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import Flag from './Flag';

export default function ClockBar({ widgetId }: { widgetId: string }) {
    const [time, setTime] = useState(new Date());
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    
    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const barShowSeconds = config.barShowSeconds ?? false;
    const barIs24Hour = config.barIs24Hour ?? false;
    const barShowTimezone = config.barShowTimezone ?? false;

    // Get bar height from settings
    const settings = useSettingsStore(state => state.settings) || {};
    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeString = time.toLocaleTimeString([], {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: barShowSeconds ? '2-digit' : undefined,
        hour12: !barIs24Hour
    });

    const tzName = timeZone.split('/').pop()?.replace('_', ' ') || timeZone;

    if (barShowTimezone) {
        if (isLarge) {
            // High Bar: Time on top, Flag + Timezone name underneath
            return (
                <div className="text-white flex flex-col items-center justify-center leading-none">
                    <span className="text-sm font-semibold tracking-wide">{timeString}</span>
                    <span className="text-[10px] text-white/60 flex items-center gap-1 font-medium select-none">
                        <Flag timezone={timeZone} className="text-xs" />
                        <span>{tzName}</span>
                    </span>
                </div>
            );
        } else {
            // Low Bar: Flag and Time horizontally next to each other
            return (
                <div className="text-white text-sm font-medium tracking-wide flex items-center gap-2 select-none">
                    <span>{timeString}</span>
                    <Flag timezone={timeZone} className="text-base" />
                </div>
            );
        }
    }

    return (
        <div className="text-white text-sm font-medium tracking-wide flex items-center gap-2">
            <span>{timeString}</span>
        </div>
    );
}
