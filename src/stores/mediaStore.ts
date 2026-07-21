import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface MediaTrackEvent {
  title: string;
  artist: string;
  duration_ms: number;
}

interface MediaPlaybackEvent {
  is_playing: boolean;
}

interface MediaSnapshot {
  title: string;
  artist: string;
  duration_ms: number;
  is_playing: boolean;
  cover_path: string | null;
}

interface MediaState {
  title: string;
  artist: string;
  durationMs: number;
  isPlaying: boolean;
  /** Disk path of the cover JPEG, or null when there is no art. */
  coverPath: string | null;
  /** Bumps whenever coverPath changes (used as <img key>). */
  coverKey: number;
  listening: boolean;
  ensureListening: () => void;
  setPlayingOptimistic: (playing: boolean) => void;
  applyTrack: (title: string, artist: string, durationMs: number) => void;
  applyPlayback: (isPlaying: boolean) => void;
  applyCoverPath: (path: string | null) => void;
  applySnapshot: (snap: MediaSnapshot) => void;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  title: '',
  artist: '',
  durationMs: 0,
  isPlaying: false,
  coverPath: null,
  coverKey: 0,
  listening: false,

  applyTrack: (title, artist, durationMs) => {
    console.log('[MediaStore Debug] applyTrack:', { title, artist, durationMs });
    set({ title, artist, durationMs });
  },

  applyPlayback: (isPlaying) => {
    console.log('[MediaStore Debug] applyPlayback:', { isPlaying });
    set({ isPlaying });
  },

  applyCoverPath: (path) => {
    const prev = get().coverPath;
    console.log('[MediaStore Debug] applyCoverPath:', { path, prev });
    if (prev === path) return;
    set((s) => ({ coverPath: path, coverKey: s.coverKey + 1 }));
  },

  applySnapshot: (snap) => {
    const prevPath = get().coverPath;
    console.log('[MediaStore Debug] applySnapshot received:', snap);
    set((s) => ({
      title: snap.title,
      artist: snap.artist,
      durationMs: snap.duration_ms,
      isPlaying: snap.is_playing,
      coverPath: snap.cover_path,
      coverKey: prevPath === snap.cover_path ? s.coverKey : s.coverKey + 1,
    }));
  },

  setPlayingOptimistic: (playing) => {
    console.log('[MediaStore Debug] setPlayingOptimistic:', playing);
    set({ isPlaying: playing });
  },

  ensureListening: () => {
    console.log('[MediaStore Debug] ensureListening called. Current listening state:', get().listening);
    if (get().listening) return;
    set({ listening: true });

    void listen<MediaTrackEvent>('media_track', (e) => {
      console.log('[MediaStore Debug] Received media_track event:', e.payload);
      get().applyTrack(e.payload.title, e.payload.artist, e.payload.duration_ms);
    });

    void listen<MediaPlaybackEvent>('media_playback', (e) => {
      console.log('[MediaStore Debug] Received media_playback event:', e.payload);
      get().applyPlayback(e.payload.is_playing);
    });

    void listen<string | null>('media_cover', (e) => {
      console.log('[MediaStore Debug] Received media_cover event:', e.payload);
      get().applyCoverPath(e.payload || null);
    });

    const pullSnapshotWithRetry = (attemptsLeft: number, delayMs: number) => {
      setTimeout(() => {
        console.log(`[MediaStore Debug] Executing get_media_snapshot pull (attempts left: ${attemptsLeft})...`);
        invoke<MediaSnapshot>('get_media_snapshot')
          .then((snap) => {
            console.log(`[MediaStore Debug] get_media_snapshot result (attempt ${4 - attemptsLeft}):`, snap);
            get().applySnapshot(snap);
            if (!snap.title && attemptsLeft > 1) {
              pullSnapshotWithRetry(attemptsLeft - 1, 1000);
            }
          })
          .catch((err) => {
            console.error('[MediaStore Debug] get_media_snapshot failed:', err);
            if (attemptsLeft > 1) {
              pullSnapshotWithRetry(attemptsLeft - 1, 1000);
            }
          });
      }, delayMs);
    };

    pullSnapshotWithRetry(3, 0);
  },
}));
