import React from 'react';
import clockIcon from '../widgets/clock/icon.svg';
import aiIcon from '../widgets/ai/icon.svg';
import weatherIcon from '../widgets/weather/icon.svg';
import systemMonitorIcon from '../widgets/system_monitor/icon.svg';
import calendarIcon from '../widgets/calendar/icon.svg';

const ICONS: Record<string, string> = {
    clock: clockIcon,
    ai: aiIcon,
    weather: weatherIcon,
    system_monitor: systemMonitorIcon,
    calendar: calendarIcon
};

interface WidgetIconProps {
    type: string;
    className?: string;
}

export function WidgetIcon({ type, className }: WidgetIconProps) {
    const iconSrc = ICONS[type];
    
    if (!iconSrc) {
        // Fallback for missing icons
        return <div className={`bg-zinc-200 dark:bg-zinc-700 rounded-lg ${className}`} />;
    }
    
    return (
        <img 
            src={iconSrc} 
            alt={`${type} icon`} 
            className={className}
            draggable={false}
        />
    );
}
