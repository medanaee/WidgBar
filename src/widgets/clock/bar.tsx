import React, { useEffect, useState } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';

export default function ClockBar({ widgetId }: { widgetId: string }) {
    const [time, setTime] = useState(new Date());
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    
    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const barShowSeconds = config.barShowSeconds ?? false;
    const barIs24Hour = config.barIs24Hour ?? false;

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

    return (
        <div className="text-white text-sm font-medium tracking-wide flex items-center gap-2">
            <span>{timeString}</span>
        </div>
    );
}
