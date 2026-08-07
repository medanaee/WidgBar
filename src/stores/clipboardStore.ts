import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { isOwnerWindow } from '../lib/ownerWindow';

/** Spill full text/html/rtf to disk when any format exceeds this (UTF-8 bytes). */
const TEXT_SPILL_THRESHOLD = 350 * 1024;
/** In-store UI preview size when spilled (UTF-8 bytes, char-boundary safe). */
const TEXT_CONTENT_PREVIEW_BYTES = 25 * 1024;

export interface ClipboardItem {
  id: string;
  kind: 'text' | 'image' | 'files' | 'figma';
  textContent: string | null;
  htmlContent: string | null;
  rtfContent: string | null;
  /** Full text/html/rtf JSON on disk when spilled; otherwise null. */
  contentPath: string | null;
  /** First 25KB of plain (fallback html/rtf) for list UI when spilled. */
  contentPreview: string | null;
  imagePath: string | null;
  filePaths: string[] | null;
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
  html?: string | null;
  rtf?: string | null;
  imagePath?: string | null;
  filePaths?: string[] | null;
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
  ingestCapture: (capture: ClipboardCapture) => Promise<void>;
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

function fileNameFromPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function makeFilesPreview(paths: string[]): string {
  if (paths.length === 0) return 'Files';
  if (paths.length === 1) return makePreview(fileNameFromPath(paths[0]));
  const first = fileNameFromPath(paths[0]);
  return `${makePreview(first)} (+${paths.length - 1})`;
}

/** Truncate to at most `maxBytes` UTF-8 bytes without splitting a code point. */
function truncateUtf8Bytes(s: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(s).length <= maxBytes) return s;
  let out = '';
  let used = 0;
  for (const ch of s) {
    const n = encoder.encode(ch).length;
    if (used + n > maxBytes) break;
    out += ch;
    used += n;
  }
  return out;
}

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function normalizeLoadedItems(items: ClipboardItem[]): ClipboardItem[] {
  return items.map((i) => ({
    ...i,
    kind: i.kind === 'image' ? 'image' : i.kind === 'files' ? 'files' : i.kind === 'figma' ? 'figma' : 'text',
    htmlContent: i.htmlContent ?? null,
    rtfContent: i.rtfContent ?? null,
    filePaths: Array.isArray(i.filePaths) ? i.filePaths : null,
    textContent: i.textContent ?? null,
    contentPath: i.contentPath ?? null,
    contentPreview: i.contentPreview ?? null,
    imagePath: i.imagePath ?? null,
  }));
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

function deleteDiskFiles(paths: (string | null | undefined)[]) {
  for (const p of paths) {
    if (!p) continue;
    invoke('clipboard_delete_image_files', { path: p }).catch(console.error);
  }
}

function deleteItemDiskFiles(item: ClipboardItem) {
  if (item.imagePath) deleteDiskFiles([item.imagePath]);
  if (item.contentPath) deleteDiskFiles([item.contentPath]);
  if (item.kind === 'figma' && item.htmlContent) deleteDiskFiles([item.htmlContent]);
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
        items = normalizeLoadedItems(Array.isArray(parsed.items) ? parsed.items : []);
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
      items: normalizeLoadedItems(data.items ?? []),
      maxHistory: data.maxHistory ?? 50,
      hasInitialized: true,
    });
    if (sync) persist(data.items ?? [], data.maxHistory ?? 50, true);
  },

  setMaxHistory: (max, sync = true) => {
    const maxHistory = Math.max(5, Math.min(500, max));
    const { kept, removed } = pruneItems(get().items, maxHistory);
    removed.forEach(deleteItemDiskFiles);
    set({ items: kept, maxHistory });
    persist(kept, maxHistory, sync);
  },

  ingestCapture: async (capture) => {
    const now = Date.now();
    let kind: ClipboardItem['kind'];
    if (capture.kind === 'image') kind = 'image';
    else if (capture.kind === 'files') kind = 'files';
    else if (capture.kind === 'figma') kind = 'figma';
    else kind = 'text';

    let contentHash: string;
    let textContent: string | null = null;
    let htmlContent: string | null = null;
    let rtfContent: string | null = null;
    let contentPath: string | null = null;
    let contentPreview: string | null = null;
    let imagePath: string | null = null;
    let filePaths: string[] | null = null;
    let preview: string;

    if (kind === 'files') {
      const paths = (capture.filePaths ?? []).filter(Boolean);
      if (paths.length === 0) return;
      filePaths = paths;
      contentHash = hashStr(`f:${paths.join('\n')}`);
      preview = makeFilesPreview(paths);
    } else if (kind === 'image') {
      const path = capture.imagePath ?? null;
      if (!path) return;
      imagePath = path;
      contentHash = hashStr(`i:${path}`);
      preview = 'Image';
    } else if (kind === 'figma') {
      const path = capture.html ?? null;
      if (!path) return;
      htmlContent = path;
      contentHash = hashStr(`figma:${path}`);
      preview = 'Figma Component';
    } else {
      const text = (capture.text ?? '').trim();
      const html = (capture.html ?? '').trim() || null;
      const rtf = (capture.rtf ?? '').trim() || null;
      if (!text && !html && !rtf) return;

      contentHash = hashStr(`t:${text}\n${html ?? ''}\n${rtf ?? ''}`);
      preview = makePreview(text || html || rtf || 'Text');

      const needsSpill =
        utf8ByteLength(text) > TEXT_SPILL_THRESHOLD ||
        (html != null && utf8ByteLength(html) > TEXT_SPILL_THRESHOLD) ||
        (rtf != null && utf8ByteLength(rtf) > TEXT_SPILL_THRESHOLD);

      if (needsSpill) {
        try {
          contentPath = await invoke<string>('clipboard_save_text_payload', {
            text: text || null,
            html,
            rtf,
          });
          const previewSource = text || html || rtf || '';
          contentPreview = truncateUtf8Bytes(previewSource, TEXT_CONTENT_PREVIEW_BYTES);
          textContent = null;
          htmlContent = null;
          rtfContent = null;
        } catch (e) {
          console.error('Failed to spill large clipboard text to disk; storing inline', e);
          textContent = text || null;
          htmlContent = html;
          rtfContent = rtf;
          contentPath = null;
          contentPreview = null;
        }
      } else {
        textContent = text || null;
        htmlContent = html;
        rtfContent = rtf;
      }
    }

    const prev = get().items;
    const existing = prev.find((i) => i.contentHash === contentHash);
    let next: ClipboardItem[];

    if (existing) {
      if (
        existing.contentPath &&
        contentPath &&
        existing.contentPath !== contentPath
      ) {
        deleteDiskFiles([existing.contentPath]);
      }
      if (
        kind === 'image' &&
        existing.imagePath &&
        imagePath &&
        existing.imagePath !== imagePath
      ) {
        deleteDiskFiles([existing.imagePath]);
      }
      next = prev.map((i) =>
        i.id === existing.id
          ? {
              ...i,
              createdAt: now,
              updatedAt: now,
              textContent,
              htmlContent,
              rtfContent,
              contentPath,
              contentPreview,
              imagePath,
              filePaths,
              preview,
            }
          : i,
      );
    } else {
      const item: ClipboardItem = {
        id: newId(),
        kind,
        textContent,
        htmlContent,
        rtfContent,
        contentPath,
        contentPreview,
        imagePath,
        filePaths,
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
    removed.forEach(deleteItemDiskFiles);
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
    if (target) deleteItemDiskFiles(target);
    set({ items });
    persist(items, get().maxHistory, true);
  },

  clearAll: () => {
    const kept = get().items.filter((i) => i.frozen);
    const removed = get().items.filter((i) => !i.frozen);
    removed.forEach(deleteItemDiskFiles);
    set({ items: kept });
    persist(kept, get().maxHistory, true);
  },
}));

let clipRefCount = 0;
let clipUnlistenFns: Array<() => void> = [];

export function subscribeClipboardSync(): () => void {
  clipRefCount++;
  if (clipRefCount === 1) {
    let active = true;
    useClipboardStore.getState().fetchHistory().catch(console.error);

    Promise.all([
      listen('clipboard-history-sync', (event: any) => {
        const data = event.payload as ClipboardPersist | undefined;
        if (data) {
          useClipboardStore.getState().replaceState(data, false);
        }
      }),
      listen<ClipboardCapture>('clipboard-changed', async (event) => {
        if (!(await isOwnerWindow())) return;
        await useClipboardStore.getState().ingestCapture(event.payload);
      }),
    ])
      .then((unlistens) => {
        if (!active) {
          unlistens.forEach((u) => u());
        } else {
          clipUnlistenFns = unlistens;
        }
      })
      .catch(console.error);
  }

  return () => {
    clipRefCount--;
    if (clipRefCount <= 0) {
      clipRefCount = 0;
      clipUnlistenFns.forEach((u) => u());
      clipUnlistenFns = [];
    }
  };
}
