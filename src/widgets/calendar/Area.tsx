import React, { useState, useEffect, useMemo } from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useTranslation, TranslationKey } from '../../lib/i18n';
import { Calendar, List, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { formatCalendarDate } from './dateUtils';

export default function CalendarArea({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { language, t } = useTranslation();

    const mainCalendar = config.mainCalendar || 'gregory';
    const secondaryCalendars = config.secondaryCalendars || [];
    const showDayOfWeek = config.showDayOfWeek ?? true;
    const showYear = config.showYear ?? true;
    const monthFormat = config.monthFormat || 'text';
    const defaultMode = config.defaultMode || 'detail';
    const showEvents = config.showEvents ?? false;

    // Current view date for grid navigation
    const [viewDate, setViewDate] = useState(() => new Date());

    // Active display mode binds directly to defaultMode setting
    const mode = defaultMode === 'grid' ? 'grid' : 'detail';

    const handleToggleMode = () => {
        const nextMode = mode === 'detail' ? 'grid' : 'detail';
        updateInstance(widgetId, { ...config, defaultMode: nextMode });
    };

    const today = useMemo(() => new Date(), []);

    // Localized formatting options
    const locale = language === 'fa' ? 'fa-IR' : 'en-US';

    // Format main calendar date for Detail View
    const mainDateFormatted = useMemo(() => {
        return formatCalendarDate(today, mainCalendar, locale, {
            showDayOfWeek,
            showYear,
            monthFormat
        });
    }, [mainCalendar, showDayOfWeek, showYear, monthFormat, locale, today]);

    // Format secondary calendars for Detail View
    const secondaryDates = useMemo(() => {
        return secondaryCalendars.map((cal: string) => {
            const formatted = formatCalendarDate(today, cal, locale, {
                showDayOfWeek: false,
                showYear: true,
                monthFormat: 'text'
            });

            if (!formatted) return null;

            const CALENDAR_KEYS: Record<string, string> = {
                'gregory': 'calGregory',
                'persian': 'calPersian',
                'islamic-umalqura': 'calIslamic',
                'hebrew': 'calHebrew',
                'chinese': 'calChinese',
                'buddhist': 'calBuddhist',
                'indian': 'calIndian'
            };
            const calKey = CALENDAR_KEYS[cal] || 'calGregory';
            const calName = t(calKey as TranslationKey);

            return { name: calName, value: formatted };
        }).filter(Boolean);
    }, [secondaryCalendars, locale, today, language, t]);

    // Grid Calculations using dynamic date iteration based on target calendar
    const gridData = useMemo(() => {
        const getMonthVal = (d: Date) => {
            try {
                const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', { calendar: mainCalendar, month: 'numeric' }).formatToParts(d);
                return parts.find(p => p.type === 'month')?.value || '';
            } catch (e) {
                return String(d.getMonth());
            }
        };

        const getDayVal = (d: Date) => {
            try {
                const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', { calendar: mainCalendar, day: 'numeric' }).formatToParts(d);
                return parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
            } catch (e) {
                return d.getDate();
            }
        };

        const targetMonth = getMonthVal(viewDate);

        // Find first day of the month by rewinding day-by-day
        let firstDay = new Date(viewDate);
        firstDay.setHours(12, 0, 0, 0); // avoid timezone boundary shifts
        let limit = 40;
        while (getDayVal(firstDay) > 1 && limit > 0) {
            firstDay.setDate(firstDay.getDate() - 1);
            limit--;
        }

        // Collect all days in this month
        const days = [];
        let current = new Date(firstDay);
        limit = 42; // standard 6 weeks max grid length
        while (getMonthVal(current) === targetMonth && limit > 0) {
            days.push({
                date: new Date(current),
                dayNum: getDayVal(current),
                isToday: current.toDateString() === today.toDateString()
            });
            current.setDate(current.getDate() + 1);
            limit--;
        }

        // Calculate empty offsets before the first day of the month
        // Saturday is start of week in Farsi, Sunday in English
        const isFarsiCalendar = mainCalendar === 'persian' || mainCalendar === 'islamic-umalqura';
        const startOffset = (language === 'fa' || isFarsiCalendar) ? (firstDay.getDay() + 1) % 7 : firstDay.getDay();
        
        const activeLocale = isFarsiCalendar ? 'fa-IR' : locale;
        const titleStr = new Intl.DateTimeFormat(activeLocale, { calendar: mainCalendar, month: 'long', year: 'numeric' }).format(viewDate);

        return {
            days,
            startOffset,
            title: titleStr.replace(/،/g, '').replace(/,/g, '')
        };
    }, [viewDate, mainCalendar, today, language, locale]);

    // Navigation handlers
    const prevMonth = () => {
        const d = new Date(viewDate);
        d.setDate(15);
        d.setDate(d.getDate() - 30);
        setViewDate(d);
    };

    const nextMonth = () => {
        const d = new Date(viewDate);
        d.setDate(15);
        d.setDate(d.getDate() + 30);
        setViewDate(d);
    };

    const prevYear = () => {
        const d = new Date(viewDate);
        d.setDate(15);
        d.setDate(d.getDate() - 365);
        setViewDate(d);
    };

    const nextYear = () => {
        const d = new Date(viewDate);
        d.setDate(15);
        d.setDate(d.getDate() + 365);
        setViewDate(d);
    };

    const resetToToday = () => {
        setViewDate(new Date());
    };

    const isFarsiCalendar = mainCalendar === 'persian' || mainCalendar === 'islamic-umalqura';
    const weekDays = (language === 'fa' || isFarsiCalendar)
        ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="flex flex-col w-full h-full text-zinc-800 dark:text-zinc-100 p-4 font-sans select-none overflow-hidden relative">
            {/* Header Switcher */}
            <div className="flex items-center justify-between mb-2 shrink-0 border-b border-zinc-500/5 pb-1">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {t("calDateEvents" as TranslationKey)}
                </span>
                <button
                    onClick={handleToggleMode}
                    className="text-zinc-500 dark:text-zinc-400"
                    title={mode === 'detail' ? 'Monthly Grid' : 'Details & Events'}
                >
                    {mode === 'detail' ? <Calendar className="w-4 h-4" /> : <List className="w-4 h-4" />}
                </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col min-h-0 justify-center">
                {mode === 'detail' ? (
                    <div className={`grid grid-cols-1 ${showEvents ? 'md:grid-cols-2' : ''} gap-4 h-full items-start`}>
                        {/* Main Date Display */}
                        <div className="flex flex-col text-start">
                            <span className="text-sm font-semibold text-primary/80 mb-0.5">
                                {t("calToday" as TranslationKey)}
                            </span>
                            <span className="text-lg font-bold leading-tight tracking-tight text-zinc-800 dark:text-zinc-100 text-start" dir="auto">
                                {mainDateFormatted}
                            </span>
                            
                            {/* Secondary Calendars */}
                            {secondaryDates.length > 0 && (
                                <div className="mt-2.5 space-y-1 border-t border-zinc-500/10 pt-2 text-left">
                                    {secondaryDates.map((item: any) => (
                                        <div key={item.name} className="text-[10px] text-zinc-500 dark:text-zinc-400 text-left" dir="auto">
                                            <span>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Events Placeholder */}
                        {showEvents && (
                            <div className="flex flex-col justify-center h-full p-3 rounded-xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/10">
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                                    {t("calTodaysEvents" as TranslationKey)}
                                </span>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                                    {t("calNoEvents" as TranslationKey)}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col h-full min-h-0">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <div className="flex items-center gap-1">
                                <button onClick={prevYear} className="p-1 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 rounded-sm" title="Prev Year">
                                    <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                                </button>
                                <button onClick={prevMonth} className="p-1 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 rounded-sm" title="Prev Month">
                                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100" dir="auto">
                                    {gridData.title}
                                </span>
                                <button onClick={resetToToday} className="p-0.5 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 rounded-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" title="Go to Today">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-1">
                                <button onClick={nextMonth} className="p-1 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 rounded-sm" title="Next Month">
                                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                                </button>
                                <button onClick={nextYear} className="p-1 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 rounded-sm" title="Next Year">
                                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-grow grid grid-cols-7 auto-rows-fr gap-x-1.5 text-center w-full min-h-0 items-center">
                                {/* Week Days Header */}
                                {weekDays.map((d, i) => {
                                    const isFarsi = language === 'fa' || mainCalendar === 'persian' || mainCalendar === 'islamic-umalqura';
                                    const isWeekend = isFarsi ? i === 6 : (i === 0 || i === 6);
                                    return (
                                        <div 
                                            key={i} 
                                            className={`text-[10px] font-bold py-0.5 ${
                                                isWeekend ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'
                                            }`}
                                        >
                                            {d}
                                        </div>
                                    );
                                })}

                                {/* Offset Days */}
                                {Array.from({ length: gridData.startOffset }).map((_, i) => (
                                    <div key={`offset-${i}`} className="h-full" />
                                ))}

                                {/* Actual Month Days */}
                                {gridData.days.map((day) => {
                                    const isFarsi = language === 'fa' || mainCalendar === 'persian' || mainCalendar === 'islamic-umalqura';
                                    const dayOfWeek = day.date.getDay();
                                    const isWeekend = isFarsi ? dayOfWeek === 5 : (dayOfWeek === 0 || dayOfWeek === 6);

                                    return (
                                        <div 
                                            key={day.date.toDateString()} 
                                            className="h-full flex items-center justify-center"
                                        >
                                            <div 
                                                className={`text-xs font-semibold rounded-md flex items-center justify-center transition-all w-7 h-7 ${
                                                    day.isToday 
                                                        ? 'bg-primary text-primary-foreground font-bold shadow-xs' 
                                                        : isWeekend
                                                            ? 'text-red-500 dark:text-red-400 hover:bg-red-500/10'
                                                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-500/10'
                                                }`}
                                            >
                                                {day.dayNum}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
