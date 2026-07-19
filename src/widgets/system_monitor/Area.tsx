import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { Cpu, Database, HardDrive, ArrowUp, ArrowDown, Globe } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area as RechartsArea, YAxis } from 'recharts';

interface SystemStats {
    cpu_usage: number;
    ram_usage: number;
    ram_used_gb: number;
    ram_total_gb: number;
    disk_usage: number;
    disk_used_gb: number;
    disk_total_gb: number;
    net_upload_kb: number;
    net_download_kb: number;
}

export default function SystemMonitorArea({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [dimensions, setDimensions] = useState({ width: 300, height: 180 });
    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
    const updateConstraints = useUpdateWidgetConstraints(widgetId);

    // Apply constraints
    useEffect(() => {
        updateConstraints({
            minW: 150,
            maxW: 800,
            minH: 100,
            maxH: 800,
        });
    }, [updateConstraints]);

    const [history, setHistory] = useState<{
        cpu: number[];
        ram: number[];
        disk: number[];
        netDown: number[];
        netUp: number[];
    }>({ cpu: [], ram: [], disk: [], netDown: [], netUp: [] });

    const enabledMetrics = config.enabledMetrics || ['cpu', 'ram', 'disk', 'net'];
    const showChartsArea = config.showChartsArea ?? true;

    // Monitor resize
    useEffect(() => {
        if (!containerElement) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerElement);
        return () => observer.disconnect();
    }, [containerElement]);

    // Poll stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res: SystemStats = await invoke('get_system_stats');
                setStats(res);

                setHistory(prev => {
                    const keep = 20;
                    return {
                        cpu: [...prev.cpu.slice(-keep + 1), res.cpu_usage],
                        ram: [...prev.ram.slice(-keep + 1), res.ram_usage],
                        disk: [...prev.disk.slice(-keep + 1), res.disk_usage],
                        netDown: [...prev.netDown.slice(-keep + 1), res.net_download_kb],
                        netUp: [...prev.netUp.slice(-keep + 1), res.net_upload_kb],
                    };
                });
            } catch (e) {
                console.error("Failed to load system stats", e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 1000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) {
        return (
            <div ref={setContainerElement} className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                <span>Loading system stats...</span>
            </div>
        );
    }

    // Determine grid columns dynamically based on container width
    const getGridCols = () => {
        const activeCount = enabledMetrics.length;
        if (dimensions.width < 220) return 'grid-cols-1';
        if (dimensions.width < 420) return `grid-cols-${Math.min(2, activeCount)}`;
        if (dimensions.width < 620) return `grid-cols-${Math.min(3, activeCount)}`;
        return `grid-cols-${Math.min(4, activeCount)}`;
    };

    const renderSparkline = (data: number[], maxVal = 100, color = '#3b82f6') => {
        if (!showChartsArea || data.length < 2) return null;
        
        const limit = Math.max(maxVal, ...data, 1);
        const chartData = data.map((val, i) => ({ value: val, index: i }));

        return (
            <div className="w-full h-10 mt-2 pointer-events-none select-none overflow-hidden">
                <ResponsiveContainer width="100%" height={40}>
                    <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                        <YAxis domain={[0, limit]} hide={true} />
                        <defs>
                            <linearGradient id={`glow-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.35}/>
                                <stop offset="95%" stopColor={color} stopOpacity={0.0}/>
                            </linearGradient>
                        </defs>
                        <RechartsArea 
                            type="monotone" 
                            dataKey="value" 
                            stroke={color} 
                            strokeWidth={1.5}
                            fillOpacity={1} 
                            fill={`url(#glow-${color.replace('#', '')})`} 
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    };

    return (
        <div 
            ref={setContainerElement} 
            className="w-full h-full text-zinc-800 dark:text-zinc-100 p-3 md:p-4 flex flex-col justify-between overflow-hidden relative pointer-events-none select-none"
        >
            <div className={`grid ${getGridCols()} gap-3 w-full h-full items-stretch`}>
                {/* CPU Card */}
                {enabledMetrics.includes('cpu') && (
                    <div className="flex flex-col justify-between p-3 rounded-xl bg-white/40 dark:bg-zinc-500/10 border border-zinc-500/10 dark:border-zinc-500/10 shadow-sm  hover:bg-white/60 dark:hover:bg-zinc-500/20 transition-all pointer-events-auto">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5">
                                <Cpu className="w-4 h-4 text-blue-500/80" />
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">CPU</span>
                            </div>
                            <span className="text-base font-bold tabular-nums">{Math.round(stats.cpu_usage)}%</span>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                            <div className="w-full">
                                <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-500" 
                                        style={{ width: `${stats.cpu_usage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        {showChartsArea && renderSparkline(history.cpu, 100, '#3b82f6')}
                    </div>
                )}

                {/* RAM Card */}
                {enabledMetrics.includes('ram') && (
                    <div className="flex flex-col justify-between p-3 rounded-xl bg-white/40 dark:bg-zinc-500/10 border border-zinc-500/10 dark:border-zinc-500/10 shadow-sm  hover:bg-white/60 dark:hover:bg-zinc-500/20 transition-all pointer-events-auto">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5">
                                <Database className="w-4 h-4 text-emerald-500/80" />
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">RAM</span>
                            </div>
                            <span className="text-base font-bold tabular-nums">
                                {config.ramValueType === 'used' ? `${stats.ram_used_gb.toFixed(1)} GB` : `${Math.round(stats.ram_usage)}%`}
                            </span>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                            <div className="w-full">
                                <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5 font-medium">
                                    <span>{config.ramValueType === 'used' ? `${Math.round(stats.ram_usage)}%` : `${stats.ram_used_gb.toFixed(1)} GB`}</span>
                                    <span>{stats.ram_total_gb.toFixed(0)} GB</span>
                                </div>
                                <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-500" 
                                        style={{ width: `${stats.ram_usage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        {showChartsArea && renderSparkline(history.ram, 100, '#10b981')}
                    </div>
                )}

                {/* Disk Card */}
                {enabledMetrics.includes('disk') && (
                    <div className="flex flex-col justify-between p-3 rounded-xl bg-white/40 dark:bg-zinc-500/10 border border-zinc-500/10 dark:border-zinc-500/10 shadow-sm  hover:bg-white/60 dark:hover:bg-zinc-500/20 transition-all pointer-events-auto">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5">
                                <HardDrive className="w-4 h-4 text-purple-500/80" />
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">DISK</span>
                            </div>
                            <span className="text-base font-bold tabular-nums">
                                {config.diskValueType === 'used' ? `${stats.disk_used_gb.toFixed(0)} GB` : `${Math.round(stats.disk_usage)}%`}
                            </span>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                            <div className="w-full">
                                <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5 font-medium">
                                    <span>{config.diskValueType === 'used' ? `${Math.round(stats.disk_usage)}%` : `${stats.disk_used_gb.toFixed(0)} GB`}</span>
                                    <span>{stats.disk_total_gb.toFixed(0)} GB</span>
                                </div>
                                <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-purple-500 transition-all duration-500" 
                                        style={{ width: `${stats.disk_usage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        {showChartsArea && renderSparkline(history.disk, 100, '#8b5cf6')}
                    </div>
                )}

                {/* Network Card */}
                {enabledMetrics.includes('net') && (
                    <div className="flex flex-col justify-between p-3 rounded-xl bg-white/40 dark:bg-zinc-500/10 border border-zinc-500/10 dark:border-zinc-500/10 shadow-sm  hover:bg-white/60 dark:hover:bg-zinc-500/20 transition-all pointer-events-auto">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5">
                                <Globe className="w-4 h-4 text-amber-500/80" />
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">NET</span>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                                <span className="text-xs font-bold flex items-center gap-0.5 tabular-nums">
                                    <ArrowDown className="w-2.5 h-2.5 text-amber-500" />
                                    {stats.net_download_kb > 1024 
                                        ? `${(stats.net_download_kb / 1024).toFixed(1)} MB/s` 
                                        : `${Math.round(stats.net_download_kb)} KB/s`
                                    }
                                </span>
                                <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-0.5 mt-0.5 tabular-nums">
                                    <ArrowUp className="w-2.5 h-2.5 text-orange-500" />
                                    {stats.net_upload_kb > 1024 
                                        ? `${(stats.net_upload_kb / 1024).toFixed(1)} MB/s` 
                                        : `${Math.round(stats.net_upload_kb)} KB/s`
                                    }
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                            <div className="w-full">
                                <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                            </div>
                        </div>
                        {showChartsArea && (
                            <div className="mt-2 flex gap-2 w-full">
                                <div className="flex-1 min-w-0">
                                    {renderSparkline(history.netDown, 512, '#f59e0b')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {renderSparkline(history.netUp, 512, '#f97316')}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
