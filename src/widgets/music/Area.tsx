import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useTranslation } from '../../lib/i18n';
import {
    Play, Pause, SkipBack, SkipForward,
    Volume2, Volume1, VolumeX, Disc,
} from 'lucide-react';
import { useMediaSession } from './useMediaSession';

export default function MusicArea({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const media = useMediaSession();
    const [volume, setVolume] = useState(50);
    const [isDraggingSeek, setIsDraggingSeek] = useState(false);
    const [dragSeekVal, setDragSeekVal] = useState(0);
    const [imgError, setImgError] = useState(false);
    const { t } = useTranslation();

    const coverAsBackground = config.coverAsBackground ?? false;

    useEffect(() => {
        setImgError(false);
    }, [media.coverKey]);

    useEffect(() => {
        const fetchVolume = async () => {
            try {
                const vol = await invoke<number>('get_system_volume');
                setVolume(Math.round(vol * 100));
            } catch (e) {
                console.error('Failed to fetch system volume', e);
            }
        };

        fetchVolume();
        const interval = setInterval(fetchVolume, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleCommand = async (cmd: string) => {
        try {
            await invoke('send_media_command', { command: cmd, seekPosMs: null });
            if (cmd === 'toggle') {
                media.setPlayingOptimistic(!media.is_playing);
            }
        } catch (e) {
            console.error('Failed to send command', e);
        }
    };

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDragSeekVal(Number(e.target.value));
    };

    const handleSeekStart = () => {
        setIsDraggingSeek(true);
        setDragSeekVal(media.position_ms);
    };

    const handleSeekEnd = async () => {
        setIsDraggingSeek(false);
        try {
            await invoke('send_media_command', { command: 'seek', seekPosMs: dragSeekVal });
            media.setPositionOptimistic(dragSeekVal);
        } catch (e) {
            console.error('Failed to seek', e);
        }
    };

    const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setVolume(val);
        try {
            await invoke('set_system_volume', { vol: val / 100 });
        } catch (e) {
            console.error('Failed to set system volume', e);
        }
    };

    const formatTime = (ms: number) => {
        if (!ms || isNaN(ms)) return '0:00';
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentPosition = isDraggingSeek ? dragSeekVal : media.position_ms;
    const duration = media.duration_ms;
    const progressPercent = duration > 0 ? (currentPosition / duration) * 100 : 0;

    const VolumeIcon = () => {
        if (volume === 0) return <VolumeX className="w-4 h-4 text-zinc-400" />;
        if (volume < 50) return <Volume1 className="w-4 h-4 text-zinc-400" />;
        return <Volume2 className="w-4 h-4 text-zinc-400" />;
    };

    const isTimelineAvailable = duration > 0 && media.hasSession;

    return (
        <div className="w-full h-full relative rounded-2xl overflow-hidden border border-zinc-500/10 dark:border-zinc-500/10 flex flex-col text-zinc-900 dark:text-zinc-100 p-4 select-none group shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-zinc-500/20">
            {coverAsBackground && media.coverUrl && (
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-700 scale-100"
                    style={{ backgroundImage: `url(${media.coverUrl})` }}
                >
                    <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/80 transition-colors duration-300" />
                </div>
            )}

            <div className="relative z-10 flex gap-4 items-center shrink-0">
                {(!coverAsBackground || !media.coverUrl) && (
                    <div className="w-16 h-16 rounded-xl border border-zinc-500/15 overflow-hidden flex items-center justify-center shrink-0 bg-zinc-800/20 shadow-md">
                        {media.coverUrl && !imgError ? (
                            <img
                                key={media.coverKey}
                                src={media.coverUrl}
                                alt=""
                                className={`w-full h-full object-cover transition-transform duration-500 ${media.is_playing ? 'scale-105' : 'scale-100'}`}
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <Disc className={`w-8 h-8 text-zinc-400/80 ${media.is_playing ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                        )}
                    </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col text-left">
                    <span className="text-sm font-bold truncate block tracking-wide">
                        {media.title || t('musicNoSession')}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate block mt-0.5 font-medium">
                        {media.artist || t('musicStartPlayer')}
                    </span>
                    {media.album && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate block mt-0.5">
                            {media.album}
                        </span>
                    )}
                </div>
            </div>

            <div
                className="relative z-10 flex-1 flex justify-center items-center min-h-0 py-2"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-center items-center gap-4">
                    <button
                        disabled={!media.hasSession}
                        onClick={() => handleCommand('prev')}
                        className="p-2 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 disabled:opacity-40 hover:bg-zinc-500/5 dark:hover:bg-white/5 rounded-xl transition-all"
                    >
                        <SkipBack className="w-5 h-5 fill-current" />
                    </button>
                    <button
                        disabled={!media.hasSession}
                        onClick={() => handleCommand('toggle')}
                        className="p-3.5 bg-zinc-900/10 dark:bg-white/10 hover:bg-zinc-900/15 dark:hover:bg-white/15 text-zinc-900 dark:text-white rounded-full transition-all disabled:opacity-40 shadow-inner flex items-center justify-center border border-zinc-500/10"
                    >
                        {media.is_playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>
                    <button
                        disabled={!media.hasSession}
                        onClick={() => handleCommand('next')}
                        className="p-2 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 disabled:opacity-40 hover:bg-zinc-500/5 dark:hover:bg-white/5 rounded-xl transition-all"
                    >
                        <SkipForward className="w-5 h-5 fill-current" />
                    </button>
                </div>
            </div>

            <div
                className="relative z-10 mt-auto shrink-0 flex flex-col gap-2.5 pt-1"
                onClick={(e) => e.stopPropagation()}
            >
                {isTimelineAvailable && (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center group/seek relative">
                            <input
                                type="range"
                                min={0}
                                max={duration}
                                value={currentPosition}
                                onMouseDown={handleSeekStart}
                                onMouseUp={handleSeekEnd}
                                onTouchStart={handleSeekStart}
                                onTouchEnd={handleSeekEnd}
                                onChange={handleSeekChange}
                                className="w-full h-1 bg-zinc-500/15 dark:bg-zinc-500/25 rounded-full appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 outline-none transition-all"
                            />
                            <div
                                className="absolute left-0 top-0 h-1 bg-zinc-900 dark:bg-white rounded-full pointer-events-none"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold tabular-nums px-0.5">
                            <span>{formatTime(currentPosition)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2.5 px-0.5">
                    <VolumeIcon />
                    <div className="flex-1 relative flex items-center group/vol">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-full h-1 bg-zinc-500/15 dark:bg-zinc-500/25 rounded-full appearance-none cursor-pointer accent-zinc-800 dark:accent-zinc-200 outline-none transition-all focus:outline-none"
                        />
                        <div
                            className="absolute left-0 top-0 h-1 bg-zinc-700 dark:bg-zinc-300 rounded-full pointer-events-none"
                            style={{ width: `${volume}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-zinc-400 w-6 text-right tabular-nums font-semibold">{volume}%</span>
                </div>
            </div>
        </div>
    );
}
