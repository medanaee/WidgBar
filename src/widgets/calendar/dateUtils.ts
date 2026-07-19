export function formatCalendarDate(
    date: Date,
    calendar: string,
    locale: string,
    options: { showDayOfWeek?: boolean; showYear?: boolean; monthFormat?: 'numeric' | 'text' }
) {
    const showDayOfWeek = options.showDayOfWeek ?? true;
    const showYear = options.showYear ?? true;
    const monthFormat = options.monthFormat || 'text';

    try {
        const isFarsiCalendar = calendar === 'persian' || calendar === 'islamic-umalqura' || locale.startsWith('fa');
        
        if (isFarsiCalendar) {
            // Force fa-IR locale for Shamsi and Lunar Islamic
            const formatter = new Intl.DateTimeFormat('fa-IR', {
                calendar,
                weekday: 'long',
                day: 'numeric',
                month: monthFormat === 'text' ? 'long' : 'numeric',
                year: 'numeric'
            });

            const parts = formatter.formatToParts(date);
            
            const weekday = showDayOfWeek ? (parts.find(p => p.type === 'weekday')?.value || '') : '';
            const day = parts.find(p => p.type === 'day')?.value || '';
            const month = parts.find(p => p.type === 'month')?.value || '';
            const year = showYear ? (parts.find(p => p.type === 'year')?.value || '') : '';

            // Return in exact natural Persian order
            if (monthFormat === 'numeric') {
                const dateStr = showYear ? `${year}/${month}/${day}` : `${month}/${day}`;
                return [weekday, dateStr].filter(Boolean).join(' ');
            }
            return [weekday, day, month, year].filter(Boolean).join(' ');
        } else {
            // For Gregorian/English or other locales, let Intl handle formatting layout natively
            const str = new Intl.DateTimeFormat(locale, {
                calendar,
                weekday: showDayOfWeek ? 'long' : undefined,
                year: showYear ? 'numeric' : undefined,
                month: monthFormat === 'text' ? 'long' : 'numeric',
                day: 'numeric'
            }).format(date);
            
            return str;
        }
    } catch (e) {
        console.error('Error formatting date:', e);
        return date.toLocaleDateString(locale);
    }
}
