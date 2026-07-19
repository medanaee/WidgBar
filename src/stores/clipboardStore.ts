import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

export interface ClipboardItem {
  id: string;
  kind: 'text' | 'image';
  textContent: string | null;
  imagePath: string | null;
  preview: string;
  contentHash: string;
  pinned: boolean;
  frozen: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ClipboardCapture {
  kind: string;
  text?: string | null;
  imagePath?: string | null;
}

interface ClipboardPersist {
  items: ClipboardItem[];
  maxHistory: number;
}

interface ClipboardState {
  items: ClipboardItem[];
  maxHistory: number;
  isLoading: boolean;
  hasInitialized: boolean;
  fetchHistory: () => Promise<void>;
  setMaxHistory: (max: number, sync?: boolean) => void;
  ingestCapture: (capture: ClipboardCapture) => void;
  setPinned: (id: string, pinned: boolean) => void;
  setFrozen: (id: string, frozen: boolean) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
  replaceState: (data: ClipboardPersist, sync?: boolean) => void;
}

function makePreview(text: string): string {
  const trimmed = text.replace(/\r?\n/g, ' ').trim();
  const chars = [...trimmed];
  return chars.length <= 40 ? trimmed : chars.slice(0, 40).join('') + '…';
}

function hashStr(s: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function pruneItems(items: ClipboardItem[], maxHistory: number): {
  kept: ClipboardItem[];
  removed: ClipboardItem[];
} {
  const max = Math.max(5, Math.min(500, maxHistory));
  const pinnedOrFrozen = items.filter((i) => i.pinned || i.frozen);
  let rest = items
    .filter((i) => !i.pinned && !i.frozen)
    .sort((a, b) => b.createdAt - a.createdAt);

  const removed: ClipboardItem[] = [];
  if (rest.length > max) {
    removed.push(...rest.slice(max));
    rest = rest.slice(0, max);
  }

  const kept = [...pinnedOrFrozen, ...rest].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  return { kept, removed };
}

function deleteImageFiles(paths: (string | null | undefined)[]) {
  for (const p of paths) {
    if (!p) continue;
    invoke('clipboard_delete_image_files', { path: p }).catch(console.error);
  }
}

function persist(items: ClipboardItem[], maxHistory: number, sync: boolean) {
  if (!sync) return;
  const payload: ClipboardPersist = { items, maxHistory };
  invoke('save_clipboard_history', { data: JSON.stringify(payload) }).catch(console.error);
  emit('clipboard-history-sync', payload).catch(console.error);
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  maxHistory: 50,
  isLoading: false,
  hasInitialized: false,

  fetchHistory: async () => {
    set({ isLoading: true });
    try {
      const raw = await invoke<string>('load_clipboard_history');
      let items: ClipboardItem[] = [];
      let maxHistory = 50;
      if (raw && raw !== '{}') {
        const parsed = JSON.parse(raw) as ClipboardPersist;
        items = Array.isArray(parsed.items) ? parsed.items : [];
        maxHistory = parsed.maxHistory ?? 50;
      }
      set({ items, maxHistory, isLoading: false, hasInitialized: true });
    } catch (e) {
      console.error('Failed to load clipboard history', e);
      set({ isLoading: false });
    }
  },

  replaceState: (data, sync = false) => {
    set({
      items: data.items ?? [],
      maxHistory: data.maxHistory ?? 50,
      hasInitialized: true,
    });
    if (sync) persist(data.items ?? [], data.maxHistory ?? 50, true);
  },

  setMaxHistory: (max, sync = true) => {
    const maxHistory = Math.max(5, Math.min(500, max));
    const { kept, removed } = pruneItems(get().items, maxHistory);
    deleteImageFiles(removed.map((i) => i.imagePath));
    set({ items: kept, maxHistory });
    persist(kept, maxHistory, sync);
  },

  ingestCapture: (capture) => {
    const now = Date.now();
    const kind = capture.kind === 'image' ? 'image' : 'text';
    let contentHash: string;
    let textContent: string | null = null;
    let imagePath: string | null = null;
    let preview: string;

    if (kind === 'text') {
      const text = (capture.text ?? '').trim();
      if (!text) return;
      textContent = text;
      contentHash = hashStr(`t:${text}`);
      preview = makePreview(text);
    } else {
      const path = capture.imagePath ?? null;
      if (!path) return;
      imagePath = path;
      contentHash = hashStr(`i:${path}`);
      preview = 'Image';
    }

    const prev = get().items;
    const existing = prev.find((i) => i.contentHash === contentHash);
    let next: ClipboardItem[];

    if (existing) {
      next = prev.map((i) =>
        i.id === existing.id
          ? { ...i, createdAt: now, updatedAt: now, textContent, imagePath, preview }
          : i,
      );
      // If re-copied image produced a new file path, drop the old orphan files
      if (
        kind === 'image' &&
        existing.imagePath &&
        imagePath &&
        existing.imagePath !== imagePath
      ) {
        deleteImageFiles([existing.imagePath]);
      }
    } else {
      const item: ClipboardItem = {
        id: newId(),
        kind,
        textContent,
        imagePath,
        preview,
        contentHash,
        pinned: false,
        frozen: false,
        createdAt: now,
        updatedAt: now,
      };
      next = [item, ...prev];
    }

    const { kept, removed } = pruneItems(next, get().maxHistory);
    deleteImageFiles(removed.map((i) => i.imagePath));
    set({ items: kept });
    persist(kept, get().maxHistory, true);
  },

  setPinned: (id, pinned) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, pinned, updatedAt: Date.now() } : i,
    );
    const sorted = [...items].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
    set({ items: sorted });
    persist(sorted, get().maxHistory, true);
  },

  setFrozen: (id, frozen) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, frozen, updatedAt: Date.now() } : i,
    );
    set({ items });
    persist(items, get().maxHistory, true);
  },

  deleteItem: (id) => {
    const target = get().items.find((i) => i.id === id);
    const items = get().items.filter((i) => i.id !== id);
    if (target?.imagePath) deleteImageFiles([target.imagePath]);
    set({ items });
    persist(items, get().maxHistory, true);
  },

  clearAll: () => {
    const kept = get().items.filter((i) => i.frozen);
    const removed = get().items.filter((i) => !i.frozen);
    deleteImageFiles(removed.map((i) => i.imagePath));
    set({ items: kept });
    persist(kept, get().maxHistory, true);
  },
}));

listen('clipboard-history-sync', (event: any) => {
  const data = event.payload as ClipboardPersist | undefined;
  if (data) {
    useClipboardStore.getState().replaceState(data, false);
  }
}).catch(console.error);

// Only the main window owns capture → store, so bar/popup don't double-insert.
listen<ClipboardCapture>('clipboard-changed', (event) => {
  try {
    if (getCurrentWebviewWindow().label !== 'main') return;
  } catch {
    return;
  }
  useClipboardStore.getState().ingestCapture(event.payload);
}).catch(console.error);
