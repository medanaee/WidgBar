import { useEffect, useMemo, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  type ClipboardItem,
  useClipboardStore,
} from '../../stores/clipboardStore';
import { contextMenuHeight } from '../../components/ui/ContextMenu';

export type { ClipboardItem };

export function imageSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  // Full PNG has sibling thumb; legacy items may already be small JPEGs
  if (/\.png$/i.test(path) && !/_t\.png$/i.test(path)) {
    const thumb = path.replace(/\.png$/i, '_t.png');
    return convertFileSrc(thumb);
  }
  return convertFileSrc(path);
}

/** Bar-visible items: pinned + optional recent slots (with optional TTL). */
export function useBarClipboardItems(
  items: ClipboardItem[],
  opts: {
    barShowRecent: boolean;
    barItemCount: number;
    barRecentTimed: boolean;
    barRecentTtlSec: number;
  },
) {
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    if (!opts.barRecentTimed) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [opts.barRecentTimed]);

  return useMemo(() => {
    const now = Date.now();
    const pinned = items.filter((i) => i.pinned);

    let recent: ClipboardItem[] = [];
    if (opts.barShowRecent) {
      const count = Math.min(3, Math.max(1, opts.barItemCount));
      const candidates = items.filter((i) => !i.pinned).slice(0, count);
      recent = opts.barRecentTimed
        ? candidates.filter((item) => now - item.createdAt <= opts.barRecentTtlSec * 1000)
        : candidates;
    }

    const seen = new Set<string>();
    const out: ClipboardItem[] = [];
    for (const i of [...pinned, ...recent]) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push(i);
    }
    return out;
  }, [
    items,
    opts.barShowRecent,
    opts.barItemCount,
    opts.barRecentTimed,
    opts.barRecentTtlSec,
    nowTick,
  ]);
}

export async function loadClipboardTextPayload(item: ClipboardItem): Promise<{
  text: string | null;
  html: string | null;
  rtf: string | null;
}> {
  if (item.contentPath) {
    const payload = await invoke<{
      text?: string | null;
      html?: string | null;
      rtf?: string | null;
    }>('clipboard_load_text_payload', { path: item.contentPath });
    return {
      text: payload.text ?? null,
      html: payload.html ?? null,
      rtf: payload.rtf ?? null,
    };
  }
  return {
    text: item.textContent,
    html: item.htmlContent,
    rtf: item.rtfContent,
  };
}

export async function openClipboardContextMenu(
  itemId: string,
  clientX: number,
  clientY: number,
) {
  await invoke('request_popup', {
    x: clientX,
    y: clientY,
    width: 160,
    height: contextMenuHeight(2),
    route: `/context-menu/clipboard/${encodeURIComponent(itemId)}`,
    closeOnBlur: true,
    xIsCenter: false,
    animated: false,
    belowBar: false,
    center: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
  });
}

export async function pasteClipboardItem(item: ClipboardItem) {
  if (item.kind === 'figma' && item.htmlContent) {
    await invoke('clipboard_paste_figma', { path: item.htmlContent });
  } else if (item.kind === 'image' && item.imagePath) {
    await invoke('clipboard_paste_image', { path: item.imagePath });
  } else if (item.kind === 'files' && item.filePaths?.length) {
    await invoke('clipboard_paste_files', { paths: item.filePaths });
  } else {
    const { text, html, rtf } = await loadClipboardTextPayload(item);
    await invoke('clipboard_paste_formats', {
      text: text || null,
      html: html || null,
      rtf: rtf || null,
    });
  }
}

/** Receive clicks without stealing foreground focus (WS_EX_NOACTIVATE). */
export async function setWindowNoActivate(enabled: boolean) {
  await invoke('set_window_no_activate', { enabled });
}

/** Ref-counted hover helper so moving between sibling chips stays no-activate. */
let noActivateHoverDepth = 0;
let noActivateDesired = false;
let noActivateSeq = 0;

export function clipboardPasteHover(entering: boolean) {
  noActivateHoverDepth += entering ? 1 : -1;
  if (noActivateHoverDepth < 0) noActivateHoverDepth = 0;
  const next = noActivateHoverDepth > 0;
  if (next === noActivateDesired) return;
  noActivateDesired = next;
  const seq = ++noActivateSeq;
  invoke('set_window_no_activate', { enabled: next })
    .then(() => {
      if (seq !== noActivateSeq && noActivateDesired !== next) {
        return invoke('set_window_no_activate', { enabled: noActivateDesired });
      }
    })
    .catch(console.error);
}

export function resetClipboardPasteHover() {
  noActivateHoverDepth = 0;
  if (!noActivateDesired) return;
  noActivateDesired = false;
  noActivateSeq += 1;
  invoke('set_window_no_activate', { enabled: false }).catch(console.error);
}

export function useClipboardItems() {
  return useClipboardStore((s) => s.items);
}
