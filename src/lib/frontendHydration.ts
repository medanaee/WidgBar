import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWidgetInstanceStore } from '../stores/widgetInstanceStore';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';

let hydrationPromise: Promise<void> | null = null;

/**
 * Hydrates all frontend stores needed by real Bar/Area widget content.
 * The promise is shared within each WebView so callers can safely wait for
 * readiness without causing duplicate database reads.
 */
export function hydrateFrontendStores(): Promise<void> {
  if (!hydrationPromise) {
    hydrationPromise = Promise.all([
      useSettingsStore.getState().fetchAndSyncSettings(),
      useLayoutStore.getState().fetchAndSyncLayouts(),
      useWidgetInstanceStore.getState().fetchInstances(),
      useWidgetRegistryStore.getState().fetchRegistry(),
    ]).then(() => undefined);
  }

  return hydrationPromise;
}
