import React from 'react';

export default function CalendarArea({ widgetId }: { widgetId: string }) {
    const today = new Date();
    
    return (
        <div className="flex flex-col items-center justify-center w-full h-full text-zinc-800 dark:text-zinc-100 p-4 pointer-events-none">
            <h3 className="text-sm font-semibold mb-2">{today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <div className="grid grid-cols-7 gap-1 text-center w-full">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">{d}</div>
                ))}
                {/* Fake calendar grid for testing */}
                {Array.from({ length: 30 }).map((_, i) => (
                    <div 
                        key={i} 
                        className={`text-xs p-1 rounded-sm ${i + 1 === today.getDate() ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold' : 'text-zinc-600 dark:text-zinc-300'}`}
                    >
                        {i + 1}
                    </div>
                ))}
            </div>
        </div>
    );
}
