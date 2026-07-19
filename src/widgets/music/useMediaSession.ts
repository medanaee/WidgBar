import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface MediaTick {
    title: string;
    artist: string;
    album: string;
    is_playing: boolean;
    position_ms: number;
    duration_ms: number;
    track_seq: number;
    has_cover: boolean;
    /** Backend finished deciding cover for this track (ready or none). */
    cover_settled: boolean;
}

export interface MediaSession {
    title: string;
    artist: string;
    album: string;
    is_playing: boolean;
    position_ms: number;
    duration_ms: number;
    coverUrl: string | null;
    coverKey: number;
    hasSession: boolean;
    setPlayingOptimistic: (playing: boolean) => void;
    setPositionOptimistic: (ms: number) => void;
}

/**
 * Slim media session: ticks are tiny (no image). Cover fetched once per track.
 * Smooth swap: keep previous art until new art arrives, or until backend
 * confirms this track has no cover (cover_settled && !has_cover).
 */
export function useMediaSession(options?: { pulsePosition?: boolean }): MediaSession {
    const pulsePosition = options?.pulsePosition ?? true;
    const [tick, setTick] = useState<MediaTick | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [coverKey, setCoverKey] = useState(0);
    const [displayPos, setDisplayPos] = useState(0);

    const posRef = useRef(0);
    const playingRef = useRef(false);
    const durationRef = useRef(0);
    const trackSeqRef = useRef(0);
    const coverSeqRef = useRef(-1);
    const fetchGenRef = useRef(0);
    const lastFrameRef = useRef<number | null>(null);

    const clearCover = useCallback((key: number) => {
        coverSeqRef.current = -1;
        setCoverUrl(null);
        setCoverKey(key);
    }, []);

    const applyCover = useCallback((seq: number, url: string | null) => {
        if (trackSeqRef.current !== seq) return;
        if (!url) {
            clearCover(seq);
            return;
        }
        coverSeqRef.current = seq;
        setCoverUrl(url);
        setCoverKey(seq);
    }, [clearCover]);

    const fetchCover = useCallback(async (seq: number) => {
        const gen = ++fetchGenRef.current;
        try {
            const url = await invoke<string | null>('get_media_cover_data_url');
            if (gen !== fetchGenRef.current) return;
            if (trackSeqRef.current !== seq) return;
            if (!url) {
                // Don't clear here — wait for cover_settled && !has_cover
                return;
            }
            // Decode first, then swap — avoids a blank flash mid-transition
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = url;
            });
            if (gen !== fetchGenRef.current) return;
            if (trackSeqRef.current !== seq) return;
            applyCover(seq, url);
        } catch {
            // leave previous art; settled path clears if needed
        }
    }, [applyCover]);

    const applyTick = useCallback((next: MediaTick | null) => {
        if (!next) {
            fetchGenRef.current += 1;
            trackSeqRef.current = 0;
            coverSeqRef.current = -1;
            posRef.current = 0;
            playingRef.current = false;
            durationRef.current = 0;
            setTick(null);
            setCoverUrl(null);
            setCoverKey(0);
            setDisplayPos(0);
            return;
        }

        const trackChanged = trackSeqRef.current !== next.track_seq;
        trackSeqRef.current = next.track_seq;
        posRef.current = next.position_ms;
        playingRef.current = next.is_playing;
        durationRef.current = next.duration_ms;
        setTick(next);
        setDisplayPos(next.position_ms);

        if (trackChanged) {
            // Invalidate in-flight fetches, but KEEP previous coverUrl on screen
            // until the new cover loads or backend settles with no cover.
            fetchGenRef.current += 1;
            if (next.has_cover) {
                void fetchCover(next.track_seq);
            }
        } else if (next.has_cover && coverSeqRef.current !== next.track_seq) {
            void fetchCover(next.track_seq);
        }

        // Only wipe art when backend is sure this track has none
        if (next.cover_settled && !next.has_cover) {
            if (coverSeqRef.current !== next.track_seq) {
                clearCover(next.track_seq);
            }
        }
    }, [clearCover, fetchCover]);

    useEffect(() => {
        let unTick: (() => void) | undefined;
        let unCover: (() => void) | undefined;
        let cancelled = false;

        (async () => {
            try {
                const initial = await invoke<MediaTick | null>('get_current_media_state');
                if (!cancelled) applyTick(initial);
            } catch {
                /* listener fills in */
            }

            unTick = await listen<MediaTick | null>('media_tick', (e) => {
                applyTick(e.payload);
            });

            unCover = await listen<number>('media_cover_ready', (e) => {
                const seq = e.payload;
                if (trackSeqRef.current === seq) {
                    void fetchCover(seq);
                }
            });
        })();

        return () => {
            cancelled = true;
            unTick?.();
            unCover?.();
        };
    }, [applyTick, fetchCover]);

    useEffect(() => {
        if (!pulsePosition || !tick?.is_playing) {
            lastFrameRef.current = null;
            return;
        }

        let raf = 0;
        let lastPulse = performance.now();

        const loop = (now: number) => {
            if (lastFrameRef.current != null) {
                const dt = now - lastFrameRef.current;
                posRef.current = Math.min(
                    durationRef.current || Number.POSITIVE_INFINITY,
                    posRef.current + dt,
                );
            }
            lastFrameRef.current = now;

            if (now - lastPulse >= 500) {
                lastPulse = now;
                setDisplayPos(Math.floor(posRef.current));
            }

            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [pulsePosition, tick?.is_playing, tick?.track_seq]);

    const setPlayingOptimistic = useCallback((playing: boolean) => {
        playingRef.current = playing;
        setTick((prev) => (prev ? { ...prev, is_playing: playing } : prev));
    }, []);

    const setPositionOptimistic = useCallback((ms: number) => {
        posRef.current = ms;
        setDisplayPos(ms);
        setTick((prev) => (prev ? { ...prev, position_ms: ms } : prev));
    }, []);

    // Keep showing previous cover during pending swap (coverSeq may lag track_seq)
    const visibleCover = coverUrl;

    return {
        title: tick?.title ?? '',
        artist: tick?.artist ?? '',
        album: tick?.album ?? '',
        is_playing: tick?.is_playing ?? false,
        position_ms: displayPos,
        duration_ms: tick?.duration_ms ?? 0,
        coverUrl: visibleCover,
        coverKey,
        hasSession: !!(tick && tick.title),
        setPlayingOptimistic,
        setPositionOptimistic,
    };
}
