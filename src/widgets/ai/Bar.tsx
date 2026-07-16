import React from 'react';
import { BotSparkleColor } from '@fluentui/react-icons';

export default function AiBar({ widgetId }: { widgetId: string }) {
    return (
        <div className="text-zinc-800 dark:text-zinc-200 text-sm font-medium tracking-wide flex items-center gap-2">
            <BotSparkleColor fontSize={18} />
            <span>AI Chat</span>
        </div>
    );
}
