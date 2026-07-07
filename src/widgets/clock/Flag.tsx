import React from 'react';

const cityMap: Record<string, string> = {
    'tehran': '🇮🇷', 'dubai': '🇦🇪', 'london': '🇬🇧', 'paris': '🇫🇷', 'berlin': '🇩🇪',
    'rome': '🇮🇹', 'tokyo': '🇯🇵', 'sydney': '🇦🇺', 'melbourne': '🇦🇺', 'new_york': '🇺🇸',
    'los_angeles': '🇺🇸', 'chicago': '🇺🇸', 'denver': '🇺🇸', 'toronto': '🇨🇦', 'vancouver': '🇨🇦',
    'seoul': '🇰🇷', 'shanghai': '🇨🇳', 'moscow': '🇷🇺', 'singapore': '🇸🇬', 'cairo': '🇪🇬',
    'istanbul': '🇹🇷', 'riyadh': '🇸🇦', 'utc': '🌐', 'gmt': '🌐'
};

export function getFlagEmoji(tz: string): string {
    const tzLower = tz.toLowerCase();
    for (const [city, flag] of Object.entries(cityMap)) {
        if (tzLower.includes(city)) return flag;
    }
    return '📍';
}

interface FlagProps {
    timezone: string;
    className?: string;
}

export default function Flag({ timezone, className = "" }: FlagProps) {
    const flag = getFlagEmoji(timezone);
    return (
        <span 
            className={`inline-block select-none font-['Twemoji_Country_Flags',_'Segoe_UI_Emoji',_sans-serif] ${className}`}
            style={{ fontFamily: '"Twemoji Country Flags", "Segoe UI Emoji", sans-serif' }}
        >
            {flag}
        </span>
    );
}
