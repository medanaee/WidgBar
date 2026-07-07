import React, { useState, useEffect } from 'react';

export default function TimerBar({ widgetId }: { widgetId: string }) {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-300">
            <span>{m}:{s}</span>
        </div>
    );
}
