import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Cpu, Database, HardDrive, ArrowUp, ArrowDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area as RechartsArea, YAxis } from 'recharts';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';

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

export default function SystemMonitorBar({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const settings = useSettingsStore(state => state.settings) || {};
    
    const [stats, setStats] = useState<SystemStats | null>(null);
    const updateConstraints = useUpdateWidgetConstraints(widgetId);

    useEffect(() => {
        updateConstraints({ barPadding: 0 });
    }, [widgetId, updateConstraints]);
    const [history, setHistory] = useState<{
        cpu: number[];
        ram: number[];
        disk: number[];
        netDown: number[];
        netUp: number[];
    }>({ cpu: [], ram: [], disk: [], netDown: [], netUp: [] });

    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;

    const enabledMetrics = config.enabledMetrics || ['cpu', 'ram', 'disk', 'net'];
    const showLabelsBar = config.showLabelsBar ?? false;
    const fillIndicatorsBar = config.fillIndicatorsBar ?? false;
    const showCpuChart = config.showCpuChartBar ?? config.showChartsBar ?? false;
    const showRamChart = config.showRamChartBar ?? config.showChartsBar ?? false;
    const showDiskChart = config.showDiskChartBar ?? config.showChartsBar ?? false;
    const showNetChart = config.showNetChartBar ?? config.showChartsBar ?? false;
    const disableClickPopup = config.disableClickPopup ?? false;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res: SystemStats = await invoke('get_system_stats');
                setStats(res);

                setHistory(prev => {
                    const keep = 15;
                    return {
                        cpu: [...prev.cpu.slice(-keep + 1), res.cpu_usage],
                        ram: [...prev.ram.slice(-keep + 1), res.ram_usage],
                        disk: [...prev.disk.slice(-keep + 1), res.disk_usage],
                        netDown: [...prev.netDown.slice(-keep + 1), res.net_download_kb],
                        netUp: [...prev.netUp.slice(-keep + 1), res.net_upload_kb],
                    };
                });
            } catch (e) {
                console.error("Failed to load system stats in bar", e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleRootClick = (e: any) => {
        if (disableClickPopup) {
            e.stopPropagation();
        }
    };

    if (!stats) {
        return (
            <div onClick={handleRootClick} className="text-white/60 text-xs px-2 flex items-center gap-1.5 leading-none">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            </div>
        );
    }

    const renderBarSparkline = (data: number[], color = '#3b82f6') => {
        if (!isLarge || data.length < 2) return null;
        const chartData = data.map((val, i) => ({ value: val, index: i }));

        return (
            <div className="w-10 h-3 pointer-events-none select-none overflow-hidden opacity-90">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
                        <YAxis domain={[0, 100]} hide={true} />
                        <RechartsArea 
                            type="monotone" 
                            dataKey="value" 
                            stroke={color} 
                            strokeWidth={1.2}
                            fill="none" 
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const renderDoubleBarSparkline = (downData: number[], upData: number[]) => {
        if (!isLarge || downData.length < 2) return null;
        
        const limit = Math.max(512, ...downData, ...upData, 1);
        const chartData = downData.map((val, i) => ({
            down: val,
            up: upData[i] || 0,
            index: i
        }));

        return (
            <div className="w-10 h-8 pointer-events-none select-none overflow-hidden opacity-90">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
                        <YAxis domain={[0, limit]} hide={true} />
                        <RechartsArea 
                            type="monotone" 
                            dataKey="down" 
                            stroke="#f59e0b" 
                            fill="none" 
                            strokeWidth={1.2}
                            isAnimationActive={false}
                        />
                        <RechartsArea 
                            type="monotone" 
                            dataKey="up" 
                            stroke="#f97316" 
                            fill="none" 
                            strokeWidth={1.2}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Card styling builders
    const getCardStyle = (usage: number, colorRgba: string) => {
        if (!fillIndicatorsBar) return {};
        // Horizontal fill styling using linear-gradient
        return {
            background: `linear-gradient(90deg, ${colorRgba} 0%, ${colorRgba} ${usage}%, transparent ${usage}%)`
        };
    };

    return (
        <div 
            onClick={handleRootClick} 
            className={`flex items-center ${fillIndicatorsBar ? 'gap-1' : 'gap-0'} text-white h-full select-none`}
        >
            {/* CPU */}
            {enabledMetrics.includes('cpu') && (
                <div 
                    className={`flex items-start gap-1.5  px-1 py-0.5 transition-all text-xs ${isLarge ? 'flex-col justify-center h-10 min-w-15' : 'h-7'} ${
                        fillIndicatorsBar 
                            ? 'rounded-lg border border-white/5 bg-white/5 shadow-sm' 
                            : 'border border-transparent bg-transparent'
                    }`}
                    style={getCardStyle(stats.cpu_usage, 'rgba(59, 130, 246, 0.2)')}
                >
                    <div className="flex items-center gap-1 leading-none">
                        <Cpu className="w-3.5 h-3.5 text-blue-400" />
                        {showLabelsBar && <span className="font-semibold text-[10px] text-white/70">CPU</span>}
                        <span className="font-bold tabular-nums inline-block text-left min-w-7">{Math.round(stats.cpu_usage)}%</span>
                    </div>
                    {isLarge && showCpuChart && (
                        <div className="mt-0.5">
                            {renderBarSparkline(history.cpu, '#3b82f6')}
                        </div>
                    )}
                </div>
            )}

            {/* RAM */}
            {enabledMetrics.includes('ram') && (
                <div 
                    className={`flex items-start gap-1.5  px-1 py-0.5 transition-all text-xs ${isLarge ? 'flex-col justify-center h-10 min-w-15' : 'h-7'} ${
                        fillIndicatorsBar 
                            ? 'rounded-lg border border-white/5 bg-white/5 shadow-sm' 
                            : 'border border-transparent bg-transparent'
                    }`}
                    style={getCardStyle(stats.ram_usage, 'rgba(16, 185, 129, 0.2)')}
                >
                    <div className="flex items-center gap-1 leading-none">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        {showLabelsBar && <span className="font-semibold text-[10px] text-white/70">RAM</span>}
                        <span className="font-bold tabular-nums inline-block text-left min-w-7">
                            {config.ramValueType === 'used' ? `${stats.ram_used_gb.toFixed(1)}G` : `${Math.round(stats.ram_usage)}%`}
                        </span>
                    </div>
                    {isLarge && showRamChart && (
                        <div className="mt-0.5">
                            {renderBarSparkline(history.ram, '#10b981')}
                        </div>
                    )}
                </div>
            )}

            {/* Disk */}
            {enabledMetrics.includes('disk') && (
                <div 
                    className={`flex items-center gap-1.5  px-1 py-0.5 transition-all text-xs ${isLarge ? 'flex-col justify-center h-10 min-w-[60px]' : 'h-7'} ${
                        fillIndicatorsBar 
                            ? 'rounded-lg border border-white/5 bg-white/5 shadow-sm' 
                            : 'border border-transparent bg-transparent'
                    }`}
                    style={getCardStyle(stats.disk_usage, 'rgba(139, 92, 246, 0.2)')}
                >
                    <div className="flex items-center gap-1 leading-none">
                        <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                        {showLabelsBar && <span className="font-semibold text-[10px] text-white/70">DSK</span>}
                        <span className="font-bold tabular-nums inline-block text-right w-[38px]">
                            {config.diskValueType === 'used' ? `${stats.disk_used_gb.toFixed(0)}G` : `${Math.round(stats.disk_usage)}%`}
                        </span>
                    </div>
                    {isLarge && showDiskChart && (
                        <div className="mt-0.5">
                            {renderBarSparkline(history.disk, '#8b5cf6')}
                        </div>
                    )}
                </div>
            )}

            {/* Network */}
            {enabledMetrics.includes('net') && (
                <div 
                    className={`flex items-center gap-1.5 px-1 py-0.5 transition-all text-xs ${isLarge ? 'flex-row justify-center h-10' : 'h-7'} ${
                        fillIndicatorsBar 
                            ? 'rounded-lg border border-white/5 bg-white/5 shadow-sm' 
                            : 'border border-transparent bg-transparent'
                    }`}
                >
                    <div className="flex items-center gap-1 leading-none">
                        <div className="flex flex-col gap-0.5 items-start tabular-nums shrink-0">
                            <span className="font-bold text-xs flex items-center gap-0.5 leading-none">
                                <ArrowDown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span className="inline-block text-right w-[42px]">
                                    {stats.net_download_kb > 1024 
                                        ? `${(stats.net_download_kb / 1024).toFixed(1)}M` 
                                        : `${Math.round(stats.net_download_kb)}K`
                                    }
                                </span>
                            </span>
                            <span className="text-xs font-semibold text-white/60 flex items-center gap-0.5 leading-none">
                                <ArrowUp className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                                <span className="inline-block text-right w-[42px]">
                                    {stats.net_upload_kb > 1024 
                                        ? `${(stats.net_upload_kb / 1024).toFixed(1)}M` 
                                        : `${Math.round(stats.net_upload_kb)}K`
                                    }
                                </span>
                            </span>
                        </div>
                    </div>
                    {isLarge && showNetChart && (
                        <div className="ml-1">
                            {renderDoubleBarSparkline(history.netDown, history.netUp)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
