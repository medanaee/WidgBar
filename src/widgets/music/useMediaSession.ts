import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useMediaStore } from '../../stores/mediaStore';

interface MediaPositionEvent {
    position_ms: number;
}

export interface MediaSession {
    title: string;
    artist: string;
    is_playing: boolean;
    position_ms: number;
    duration_ms: number;
    coverUrl: string | null;
    /** Bumps whenever the cover image swaps (used as <img key>) */
    coverKey: number;
    hasSession: boolean;
    setPlayingOptimistic: (playing: boolean) => void;
    setPositionOptimistic: (ms: number) => void;
}

/**
 * Track / cover / playback live in `useMediaStore` so late-mounted widgets
 * (e.g. Area popup) still see the current song.
 * Position is intentionally NOT stored — each widget listens live.
 */
export function useMediaSession(options?: { pulsePosition?: boolean }): MediaSession {
    const pulsePosition = options?.pulsePosition ?? true;

    const title = useMediaStore((s) => s.title);
    const artist = useMediaStore((s) => s.artist);
    const durationMs = useMediaStore((s) => s.durationMs);
    const isPlaying = useMediaStore((s) => s.isPlaying);
    const coverPath = useMediaStore((s) => s.coverPath);
    const coverKey = useMediaStore((s) => s.coverKey);
    const ensureListening = useMediaStore((s) => s.ensureListening);
    const storeSetPlaying = useMediaStore((s) => s.setPlayingOptimistic);

    const [displayPos, setDisplayPos] = useState(0);
    const posRef = useRef(0);
    const durationRef = useRef(0);
    const lastFrameRef = useRef<number | null>(null);
    const trackIdRef = useRef(`${title}\0${artist}`);

    useEffect(() => {
        ensureListening();
    }, [ensureListening]);

    // Reset local clock when the stored track identity changes.
    useEffect(() => {
        const id = `${title}\0${artist}`;
        if (trackIdRef.current !== id) {
            trackIdRef.current = id;
            posRef.current = 0;
            setDisplayPos(0);
        }
        durationRef.current = durationMs;
    }, [title, artist, durationMs]);

    // Position only — live, never written into the store.
    useEffect(() => {
        let cancelled = false;
        let unlisten: (() => void) | undefined;
        listen<MediaPositionEvent>('media_position', (e) => {
            posRef.current = e.payload.position_ms;
            setDisplayPos(e.payload.position_ms);
        }).then((u) => {
            if (cancelled) u();
            else unlisten = u;
        });
        return () => {
            cancelled = true;
            unlisten?.();
        };
    }, []);

    // Smooth position interpolation between the 1s backend ticks.
    useEffect(() => {
        if (!pulsePosition || !isPlaying) {
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
            if (now - lastPulse >= 250) {
                lastPulse = now;
                setDisplayPos(Math.floor(posRef.current));
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [pulsePosition, isPlaying]);

    const setPlayingOptimistic = useCallback((playing: boolean) => {
        storeSetPlaying(playing);
    }, [storeSetPlaying]);

    const setPositionOptimistic = useCallback((ms: number) => {
        posRef.current = ms;
        setDisplayPos(ms);
    }, []);

    const coverUrl = coverPath ? convertFileSrc(coverPath) : null;
    const hasSession = title !== '' || artist !== '';

    return {
        title,
        artist,
        is_playing: isPlaying,
        position_ms: displayPos,
        duration_ms: durationMs,
        coverUrl,
        coverKey,
        hasSession,
        setPlayingOptimistic,
        setPositionOptimistic,
    };
}
