import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../lib/i18n';
import { formatCalendarDate } from './dateUtils';

export default function CalendarBar({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const settings = useSettingsStore(state => state.settings) || {};
    const { language } = useTranslation();

    const mainCalendar = config.mainCalendar || 'gregory';
    const secondaryCalendars = config.secondaryCalendars || [];
    const barShowDayOfWeek = config.barShowDayOfWeek ?? true;
    const barShowYear = config.barShowYear ?? true;
    const barMonthFormat = config.barMonthFormat || 'text';

    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;

    const today = new Date();

    const formattedDate = React.useMemo(() => {
        return formatCalendarDate(today, mainCalendar, language === 'fa' ? 'fa-IR' : 'en-US', {
            showDayOfWeek: barShowDayOfWeek,
            showYear: barShowYear,
            monthFormat: barMonthFormat
        });
    }, [mainCalendar, barShowDayOfWeek, barShowYear, barMonthFormat, language, today]);

    const firstSecondaryCal = secondaryCalendars[0];
    const firstSecondaryDateFormatted = React.useMemo(() => {
        if (!firstSecondaryCal) return '';
        return formatCalendarDate(today, firstSecondaryCal, language === 'fa' ? 'fa-IR' : 'en-US', {
            showDayOfWeek: false,
            showYear: barShowYear,
            monthFormat: barMonthFormat
        });
    }, [firstSecondaryCal, barShowYear, barMonthFormat, language, today]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-700 dark:text-zinc-200 select-none" dir="auto">
            <span className="text-[12px] font-medium leading-tight">{formattedDate}</span>
            {isLarge && firstSecondaryDateFormatted && (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">
                    {firstSecondaryDateFormatted}
                </span>
            )}
        </div>
    );
}
