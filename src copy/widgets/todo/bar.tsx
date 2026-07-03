import React from 'react';

export default function TodoBar({ widgetId }: { widgetId: string }) {
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-300">
            <span>2 tasks</span>
        </div>
    );
}
