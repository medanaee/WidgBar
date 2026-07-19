import { useEffect, useMemo, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  type ClipboardItem,
  useClipboardStore,
} from '../../stores/clipboardStore';

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
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

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

export async function pasteClipboardItem(item: ClipboardItem) {
  if (item.kind === 'image' && item.imagePath) {
    await invoke('clipboard_paste_image', { path: item.imagePath });
  } else if (item.textContent) {
    await invoke('clipboard_paste_text', { text: item.textContent });
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
