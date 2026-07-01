import React, { useEffect, useState } from 'react';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';

export default function ClockArea({ widgetId }: { widgetId: string }) {
    const [time, setTime] = useState(new Date());
    const updateConstraints = useUpdateWidgetConstraints(widgetId);
    
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const showSeconds = config.showSeconds ?? false;
    const is24Hour = config.is24Hour ?? false;

    useEffect(() => {
        updateConstraints({
            minW: 150,
            maxW: 400,
            minH: 100,
            maxH: 250
        });
    }, [updateConstraints]);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center w-full h-full text-zinc-100 pointer-events-none">
            <div className="text-4xl font-semibold tracking-tight tabular-nums">
                {time.toLocaleTimeString([], { 
                    timeZone,
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: showSeconds ? '2-digit' : undefined,
                    hour12: !is24Hour
                })}
            </div>
            <div className="text-zinc-400 text-sm mt-1 font-medium">
                {time.toLocaleDateString(undefined, { 
                    timeZone,
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                })}
            </div>
        </div>
    );
}
