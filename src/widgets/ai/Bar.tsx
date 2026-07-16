import React from 'react';

export default function AiBar({ widgetId }: { widgetId: string }) {
    return (
        <div className="text-white text-sm font-medium tracking-wide flex items-center gap-2">
            <span>✨</span>
            <span>AI Chat</span>
        </div>
    );
}
