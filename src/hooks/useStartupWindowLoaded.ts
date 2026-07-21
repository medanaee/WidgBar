import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { hydrateFrontendStores } from '../lib/frontendHydration';

type StartupWindowType = 'bar' | 'area';

/**
 * Reports startup readiness only after:
 *  1. all persisted frontend stores have hydrated,
 *  2. every lazy widget component in this window has committed, and
 *  3. React has had two animation frames to paint the resulting content.
 */
export function useStartupWindowLoaded(
  windowType: StartupWindowType,
  monitorId: string | undefined,
  expectedWidgetIds: string[],
  enabled: boolean,
) {
  const loadedWidgetIds = useRef(new Set<string>());
  const emitted = useRef(false);
  const [storesHydrated, setStoresHydrated] = useState(false);
  const [, notifyWidgetLoaded] = useReducer((value) => value + 1, 0);

  useEffect(() => {
    let cancelled = false;
    hydrateFrontendStores()
      .then(() => {
        if (!cancelled) setStoresHydrated(true);
      })
      .catch((error) => {
        console.error('Failed to hydrate startup window stores:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markWidgetLoaded = useCallback((widgetId: string) => {
    if (loadedWidgetIds.current.has(widgetId)) return;
    loadedWidgetIds.current.add(widgetId);
    notifyWidgetLoaded();
  }, []);

  const expectedKey = expectedWidgetIds.join('\u0000');

  useEffect(() => {
    if (!enabled || !monitorId || !storesHydrated || emitted.current) return;
    if (!expectedWidgetIds.every((id) => loadedWidgetIds.current.has(id))) return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        emitted.current = true;
        emit('startup-window-loaded', {
          label: getCurrentWebviewWindow().label,
          windowType,
          monitorId,
        }).catch(console.error);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [enabled, expectedKey, expectedWidgetIds, monitorId, storesHydrated, windowType]);

  return markWidgetLoaded;
}
