import React, { useState, useEffect } from 'react';

export default function TimerArea({ widgetId }: { widgetId: string }) {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        let interval: any;
        if (isRunning) {
            interval = setInterval(() => setSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const formatTime = (totalSec: number) => {
        const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="flex flex-col items-center justify-center w-full h-full text-zinc-100 p-4 pointer-events-auto">
            <div className="text-4xl font-semibold tracking-tight text-zinc-100 mb-4">
                {formatTime(seconds)}
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setIsRunning(!isRunning)}
                    className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors"
                >
                    {isRunning ? 'Pause' : 'Start'}
                </button>
                <button 
                    onClick={() => setSeconds(0)}
                    className="px-4 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
