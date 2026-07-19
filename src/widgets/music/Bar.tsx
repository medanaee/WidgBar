import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { Music, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface MediaState {
    title: string;
    artist: string;
    album: string;
    is_playing: boolean;
    position_ms: number;
    duration_ms: number;
    thumbnail_base64: string | null;
}

export default function MusicBar({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const settings = useSettingsStore(state => state.settings) || {};
    const updateConstraints = useUpdateWidgetConstraints(widgetId);
    const [media, setMedia] = useState<MediaState | null>(null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [media?.title, media?.artist]);

    const barShowCover = config.barShowCover ?? true;
    const barShowTime = config.barShowTime ?? true;
    const barShowProgress = config.barShowProgress ?? true;
    const barShowButtons = config.barShowButtons ?? true;

    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;

    const hasSession = !!(media && media.title);

    // Hide from Bar when nothing is playing / no active session
    useEffect(() => {
        updateConstraints({ hiddenInBar: !hasSession });
        return () => {
            updateConstraints({ hiddenInBar: false });
        };
    }, [hasSession, updateConstraints]);

    // Listen to media updates from background thread
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        
        const setupListener = async () => {
            unlisten = await listen<MediaState | null>('media_update', (event) => {
                setMedia(prev => {
                    const res = event.payload;
                    if (!res) return null;
                    if (!prev || prev.title !== res.title) return res;
                    return res;
                });
            });
        };
        
        setupListener();
        
        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // Local increment of track position while playing
    useEffect(() => {
        if (!media || !media.is_playing) return;

        const interval = setInterval(() => {
            setMedia(prev => {
                if (!prev) return null;
                const nextPos = prev.position_ms + 250;
                if (nextPos >= prev.duration_ms) return prev;
                return { ...prev, position_ms: nextPos };
            });
        }, 250);

        return () => clearInterval(interval);
    }, [media?.is_playing, media?.title]);

    const handleCommand = async (cmd: string) => {
        try {
            await invoke('send_media_command', { command: cmd, seekPosMs: null });
            if (cmd === 'toggle') {
                setMedia(prev => prev ? { ...prev, is_playing: !prev.is_playing } : null);
            }
        } catch (e) {
            console.error("Failed to send media command", e);
        }
    };

    const formatTime = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!hasSession) {
        return null;
    }

    const progressPercent = media.duration_ms > 0 
        ? Math.min(100, (media.position_ms / media.duration_ms) * 100)
        : 0;

    const showFillProgress = barShowProgress && media.duration_ms > 0;
    const progressFillStyle = showFillProgress
        ? {
            background: `linear-gradient(90deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.18) ${progressPercent}%, rgba(255, 255, 255, 0.05) ${progressPercent}%)`,
          }
        : undefined;
    const boxClass = showFillProgress
        ? 'rounded-lg border border-white/5 overflow-hidden'
        : 'border border-transparent bg-transparent';

    if (isLarge) {
        return (
            <div
                className={`relative flex items-center gap-2 h-10 px-2 py-0.5 text-white select-none ${boxClass}`}
                style={progressFillStyle}
            >
                {barShowCover && (
                    <div className="relative z-10 w-8 h-8 rounded bg-zinc-800/80 border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                        {media.thumbnail_base64 && !imgError ? (
                            <img src={media.thumbnail_base64} alt="album art" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                        ) : (
                            <Music className="w-3.5 h-3.5 text-white/40" />
                        )}
                    </div>
                )}

                <div className="relative z-10 flex flex-col min-w-[70px] max-w-[120px] leading-tight text-left">
                    <span className="text-[10px] font-bold truncate block">{media.title}</span>
                    <span className="text-[8px] text-white/60 truncate block">{media.artist}</span>
                </div>

                {barShowButtons && (
                    <div className="relative z-10 flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleCommand('prev')} className="p-1 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white">
                            <SkipBack className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleCommand('toggle')} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white">
                            {media.is_playing ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                        </button>
                        <button onClick={() => handleCommand('next')} className="p-1 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white">
                            <SkipForward className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {barShowTime && media.duration_ms > 0 && (
                    <div className="relative z-10 flex flex-col gap-0.5 items-end justify-center shrink-0 ms-auto">
                        <span className="text-[8px] text-white/50 font-medium tabular-nums">
                            {formatTime(media.position_ms)} / {formatTime(media.duration_ms)}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={`relative flex items-center gap-1.5 h-7 text-white select-none ${
                showFillProgress ? 'px-1.5 rounded-md border border-white/5 overflow-hidden' : 'border border-transparent bg-transparent'
            }`}
            style={progressFillStyle}
        >
            {barShowCover && (
                <div className="relative z-10 w-5 h-5 rounded bg-zinc-800/80 border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                    {media.thumbnail_base64 && !imgError ? (
                        <img src={media.thumbnail_base64} alt="album art" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                    ) : (
                        <Music className="w-2.5 h-2.5 text-white/40" />
                    )}
                </div>
            )}

            <span className="relative z-10 text-[10px] font-bold truncate max-w-[90px]">
                {media.title} <span className="text-white/60 font-normal"> - {media.artist}</span>
            </span>

            {barShowButtons && (
                <div className="relative z-10 flex items-center gap-0.5 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleCommand('prev')} className="p-0.5 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white">
                        <SkipBack className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleCommand('toggle')} className="p-0.5 hover:bg-white/10 rounded transition-colors text-white">
                        {media.is_playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </button>
                    <button onClick={() => handleCommand('next')} className="p-0.5 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white">
                        <SkipForward className="w-3 h-3" />
                    </button>
                </div>
            )}

            {barShowTime && media.duration_ms > 0 && (
                <span className="relative z-10 text-[10px] text-white/50 tabular-nums shrink-0 font-medium ms-auto">
                    {formatTime(media.position_ms)}
                </span>
            )}
        </div>
    );
}
