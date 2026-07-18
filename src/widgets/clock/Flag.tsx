import React from 'react';
import { getTimezone } from 'countries-and-timezones';

const getFlagEmojiForCountry = (countryCode: string) => {
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

export function getFlagEmoji(tz: string): string {
    if (!tz) return '📍';
    const tzLower = tz.toLowerCase();
    if (tzLower === 'utc' || tzLower === 'gmt') {
        return '🌐';
    }
    try {
        const tzInfo = getTimezone(tz);
        if (tzInfo && tzInfo.countries && tzInfo.countries.length > 0) {
            return getFlagEmojiForCountry(tzInfo.countries[0]);
        }
    } catch (e) {
        console.error(e);
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
