import React from 'react';

export default function CalendarBar({ widgetId }: { widgetId: string }) {
    const today = new Date();
    
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-300">
            <span>{today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
    );
}
