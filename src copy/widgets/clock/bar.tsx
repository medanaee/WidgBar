import React, { useEffect, useState } from 'react';

export default function ClockBar({ widgetId }: { widgetId: string }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-white text-sm font-medium tracking-wide flex items-center gap-2">
            <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    );
}
