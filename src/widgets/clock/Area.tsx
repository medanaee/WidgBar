import React, { useEffect, useState } from 'react';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import Flag, { getFlagEmoji } from './Flag';

export default function ClockArea({ widgetId }: { widgetId: string }) {
    const [time, setTime] = useState(new Date());
    const updateConstraints = useUpdateWidgetConstraints(widgetId);
    
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const showSeconds = config.showSeconds ?? false;
    const is24Hour = config.is24Hour ?? false;
    const clockType = config.clockType || 'digital';
    const showTimezone = config.showTimezone ?? false;

    const flag = getFlagEmoji(timeZone);
    const tzName = timeZone.split('/').pop()?.replace('_', ' ') || timeZone;

    useEffect(() => {
        if (clockType === 'analog' || clockType === 'analog_macos') {
            updateConstraints({
                minW: 120,
                maxW: 500,
                minH: 120,
                maxH: 500,
                aspectRatio: 1.0 // Lock aspect ratio to 1:1 for Analog Clocks
            });
        } else {
            updateConstraints({
                minW: 150,
                maxW: 400,
                minH: 100,
                maxH: 250,
                aspectRatio: undefined // Unlock aspect ratio for Digital Clock
            });
        }
    }, [clockType, updateConstraints]);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Extract hours, minutes, and seconds relative to the selected timezone
    const getTzTime = () => {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: false,
            });
            const parts = formatter.formatToParts(time);
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
            const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
            const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
            return { hour, minute, second };
        } catch (e) {
            // Fallback to local time in case of invalid timezone
            return {
                hour: time.getHours(),
                minute: time.getMinutes(),
                second: time.getSeconds()
            };
        }
    };

    const { hour, minute, second } = getTzTime();

    // Calculate hand rotation angles in degrees
    const secondAngle = second * 6; // 360 / 60
    const minuteAngle = minute * 6 + second * 0.1; // 360 / 60 + second * (6 / 60)
    const hourAngle = (hour % 12) * 30 + minute * 0.5; // 360 / 12 + minute * (30 / 60)

    if (clockType === 'analog') {
        return (
            <div className="flex items-center justify-center w-full h-full p-3 select-none pointer-events-none">
                <svg viewBox="0 0 200 200" className="w-full h-full max-w-full max-h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                    {/* Clock face background - Premium frosted translucent look */}
                    <circle cx="100" cy="100" r="95" className="fill-white/30 dark:fill-zinc-950/20 stroke-zinc-400/20 dark:stroke-zinc-500/20" strokeWidth="1.5" />
                    <circle cx="100" cy="100" r="94" className="fill-none stroke-zinc-400/5 dark:stroke-zinc-100/5" strokeWidth="0.5" />
                    
                    {/* Subtle inner dial track */}
                    <circle cx="100" cy="100" r="86" className="fill-none stroke-zinc-400/10 dark:stroke-zinc-100/5" strokeWidth="1" strokeDasharray="1 3" />
                    
                    {/* Hour Numbers (Modern Minimalist style: 12, 3, 6, 9) */}
                    <text x="100" y="32" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[16px] font-semibold tracking-tight">12</text>
                    <text x="172" y="105" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[16px] font-semibold tracking-tight">3</text>
                    <text x="100" y="180" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[16px] font-semibold tracking-tight">6</text>
                    <text x="28" y="105" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[16px] font-semibold tracking-tight">9</text>

                    {/* Outer Ticks for hours */}
                    {[1, 2, 4, 5, 7, 8, 10, 11].map(h => {
                        const angle = h * 30 * (Math.PI / 180);
                        const x1 = 100 + 82 * Math.sin(angle);
                        const y1 = 100 - 82 * Math.cos(angle);
                        const x2 = 100 + 88 * Math.sin(angle);
                        const y2 = 100 - 88 * Math.cos(angle);
                        return (
                            <line 
                                key={h} 
                                x1={x1} y1={y1} x2={x2} y2={y2} 
                                className="stroke-zinc-500/50 dark:stroke-zinc-500/40" 
                                strokeWidth="1" 
                                strokeLinecap="round" 
                            />
                        );
                    })}

                    {/* Hour Hand */}
                    <line 
                        x1="100" y1="100" 
                        x2={100 + 44 * Math.sin(hourAngle * (Math.PI / 180))} 
                        y2={100 - 44 * Math.cos(hourAngle * (Math.PI / 180))} 
                        className="stroke-zinc-800 dark:stroke-zinc-100" 
                        strokeWidth="4" 
                        strokeLinecap="round" 
                    />

                    {/* Minute Hand */}
                    <line 
                        x1="100" y1="100" 
                        x2={100 + 66 * Math.sin(minuteAngle * (Math.PI / 180))} 
                        y2={100 - 66 * Math.cos(minuteAngle * (Math.PI / 180))} 
                        className="stroke-zinc-600 dark:stroke-zinc-300" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                    />

                    {/* Second Hand (Orange accented premium needle style) */}
                    {showSeconds && (
                        <>
                            <line 
                                x1="100" y1="100" 
                                x2={100 + 76 * Math.sin(secondAngle * (Math.PI / 180))} 
                                y2={100 - 76 * Math.cos(secondAngle * (Math.PI / 180))} 
                                className="stroke-orange-500 dark:stroke-orange-400" 
                                strokeWidth="1" 
                                strokeLinecap="round" 
                            />
                            {/* Counter-weight tail */}
                            <line 
                                x1="100" y1="100" 
                                x2={100 - 16 * Math.sin(secondAngle * (Math.PI / 180))} 
                                y2={100 + 16 * Math.cos(secondAngle * (Math.PI / 180))} 
                                className="stroke-orange-500 dark:stroke-orange-400" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                            />
                        </>
                    )}

                    {/* Center Pin & Cap */}
                    <circle cx="100" cy="100" r="4.5" className="fill-zinc-800 dark:fill-zinc-950 stroke-zinc-300 dark:stroke-zinc-100" strokeWidth="1.2" />
                    {showSeconds && (
                        <circle cx="100" cy="100" r="1.5" className="fill-orange-500 dark:fill-orange-400" />
                    )}

                    {showTimezone && (
                        <text 
                            x="100" 
                            y="145" 
                            textAnchor="middle" 
                            className="fill-zinc-400 dark:fill-zinc-500 font-sans text-[11px] font-medium tracking-wide pointer-events-none select-none"
                            style={{ fontFamily: '"Twemoji Country Flags", "Segoe UI Emoji", sans-serif' }}
                        >
                            {flag} {tzName}
                        </text>
                    )}
                </svg>
            </div>
        );
    }

    if (clockType === 'analog_macos') {
        return (
            <div className="flex items-center justify-center w-full h-full p-2 select-none pointer-events-none">
                <svg viewBox="0 0 200 200" className="w-full h-full max-w-full max-h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                    {/* Minute Ticks (faint gray) */}
                    {Array.from({ length: 60 }).map((_, m) => {
                        if (m % 5 === 0) return null;
                        return (
                            <line 
                                key={`min-${m}`}
                                x1="100" y1="8" x2="100" y2="15" 
                                className="stroke-zinc-500/40 dark:stroke-zinc-400/30" 
                                strokeWidth="1" 
                                transform={`rotate(${m * 6} 100 100)`}
                            />
                        );
                    })}

                    {/* Hour Ticks (longer and thicker) */}
                    {Array.from({ length: 12 }).map((_, h) => {
                        const isMajor = h % 3 === 0;
                        return (
                            <line 
                                key={`hr-${h}`}
                                x1="100" y1="8" x2="100" y2="24" 
                                className="stroke-zinc-800 dark:stroke-zinc-100" 
                                strokeWidth={isMajor ? 3 : 1.8} 
                                transform={`rotate(${h * 30} 100 100)`}
                            />
                        );
                    })}

                    {/* Hour Numbers (Modern Minimalist style: 12, 3, 6, 9) */}
                    <text x="100" y="46" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[20px] font-medium tracking-tight">12</text>
                    <text x="162" y="107" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[20px] font-medium tracking-tight">3</text>
                    <text x="100" y="168" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[20px] font-medium tracking-tight">6</text>
                    <text x="38" y="107" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100 font-sans text-[20px] font-medium tracking-tight">9</text>

                    {/* Hour Hand (Syringe style pointing relative to hourAngle) */}
                    <g transform={`translate(100, 100) rotate(${hourAngle})`}>
                        <path 
                            d="M -1.5,-8 L -1.5,-12 L -3.5,-15 L -3.5,-44 A 3.5,3.5 0 0,1 3.5,-44 L 3.5,-15 L 1.5,-12 L 1.5,-8 Z" 
                            className="fill-zinc-800 dark:fill-zinc-100 stroke-zinc-800 dark:stroke-zinc-100" 
                            strokeWidth="1" 
                            strokeLinejoin="round" 
                        />
                    </g>

                    {/* Minute Hand (Syringe style pointing relative to minuteAngle) */}
                    <g transform={`translate(100, 100) rotate(${minuteAngle})`}>
                        <path 
                            d="M -1.5,-8 L -1.5,-12 L -3.5,-15 L -3.5,-68 A 3.5,3.5 0 0,1 3.5,-68 L 3.5,-15 L 1.5,-12 L 1.5,-8 Z" 
                            className="fill-zinc-800 dark:fill-zinc-100 stroke-zinc-800 dark:stroke-zinc-100" 
                            strokeWidth="1" 
                            strokeLinejoin="round" 
                        />
                    </g>

                    {/* Second Hand (Orange Accented needle) */}
                    {showSeconds && (
                        <g transform={`translate(100, 100) rotate(${secondAngle})`}>
                            <line 
                                x1="0" y1="8" x2="0" y2="-82" 
                                className="stroke-orange-500 dark:stroke-orange-400" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                            />
                            <circle cx="0" cy="0" r="3" className="fill-orange-500 dark:fill-orange-400 stroke-zinc-800 dark:stroke-zinc-950" strokeWidth="1" />
                        </g>
                    )}

                    {/* Center Pin & Cap */}
                    <circle cx="100" cy="100" r="4.5" className="fill-zinc-800 dark:fill-zinc-100 stroke-zinc-800 dark:stroke-zinc-100" strokeWidth="1" />
                    {showSeconds && (
                        <circle cx="100" cy="100" r="1.5" className="fill-orange-500 dark:fill-orange-400" />
                    )}

                    {showTimezone && (
                        <text 
                            x="100" 
                            y="145" 
                            textAnchor="middle" 
                            className="fill-zinc-400 dark:fill-zinc-500 font-sans text-[11px] font-medium tracking-wide pointer-events-none select-none"
                            style={{ fontFamily: '"Twemoji Country Flags", "Segoe UI Emoji", sans-serif' }}
                        >
                            {flag} {tzName}
                        </text>
                    )}
                </svg>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center w-full h-full text-zinc-800 dark:text-zinc-100 pointer-events-none">
            <div className="text-4xl font-semibold tracking-tight tabular-nums">
                {time.toLocaleTimeString([], { 
                    timeZone,
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: showSeconds ? '2-digit' : undefined,
                    hour12: !is24Hour
                })}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 font-medium">
                {time.toLocaleDateString(undefined, { 
                    timeZone,
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                })}
            </div>
            {showTimezone && (
                <div className="text-zinc-400 dark:text-zinc-500 text-xs mt-2 font-medium flex items-center gap-1.5 select-none">
                    <Flag timezone={timeZone} className="text-sm" />
                    <span>{tzName}</span>
                </div>
            )}
        </div>
    );
}
