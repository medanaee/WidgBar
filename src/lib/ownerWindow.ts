import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

/**
 * The "owner" window is the primary monitor's bar. It's always open (the
 * primary bar can't be closed and is created on every launch), so it's the
 * home for any app-wide, single-window work that used to live in the `main`
 * window — e.g. owning clipboard capture ingestion.
 *
 * Use `isOwnerWindow()` to gate owner-only side effects in code that runs in
 * every window (stores, module-level listeners, etc.).
 */

// undefined = not fetched yet; null = no owner known.
let ownerLabel: string | null | undefined;
let inflight: Promise<string | null> | null = null;

export async function getOwnerWindowLabel(): Promise<string | null> {
  if (ownerLabel !== undefined) return ownerLabel;
  if (!inflight) {
    inflight = invoke<string | null>('get_owner_window_label')
      .then((v) => {
        ownerLabel = v ?? null;
        return ownerLabel;
      })
      .catch(() => {
        ownerLabel = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function isOwnerWindow(): Promise<boolean> {
  const owner = await getOwnerWindowLabel();
  if (!owner) return false;
  try {
    return getCurrentWebviewWindow().label === owner;
  } catch {
    return false;
  }
}

// Keep the cached owner fresh if the backend re-elects it (e.g. the primary
// bar is recreated after a monitor change and gets a new window label).
listen<string>('owner-window-changed', (event) => {
  ownerLabel = event.payload ?? null;
}).catch(() => {});
