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
    set({ title, artist, durationMs });
  },

  applyPlayback: (isPlaying) => {
    set({ isPlaying });
  },

  applyCoverPath: (path) => {
    const prev = get().coverPath;
    if (prev === path) return;
    set((s) => ({ coverPath: path, coverKey: s.coverKey + 1 }));
  },

  applySnapshot: (snap) => {
    const prevPath = get().coverPath;
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
    set({ isPlaying: playing });
  },

  ensureListening: () => {
    if (get().listening) return;
    set({ listening: true });

    void listen<MediaTrackEvent>('media_track', (e) => {
      get().applyTrack(e.payload.title, e.payload.artist, e.payload.duration_ms);
    });

    void listen<MediaPlaybackEvent>('media_playback', (e) => {
      get().applyPlayback(e.payload.is_playing);
    });

    void listen<string | null>('media_cover', (e) => {
      get().applyCoverPath(e.payload || null);
    });

    // Late-mounted widgets (e.g. Area popup) missed earlier events — pull once.
    invoke<MediaSnapshot>('get_media_snapshot')
      .then((snap) => get().applySnapshot(snap))
      .catch(() => {});
  },
}));
