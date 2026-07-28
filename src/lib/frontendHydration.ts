import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWidgetInstanceStore } from '../stores/widgetInstanceStore';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { subscribeAiServicesSync } from '../stores/aiServicesStore';

let hydrationPromise: Promise<void> | null = null;
let unsubscribeAi: (() => void) | null = null;

/**
 * Hydrates all frontend stores needed by real Bar/Area widget content.
 * The promise is shared within each WebView so callers can safely wait for
 * readiness without causing duplicate database reads.
 */
export function hydrateFrontendStores(): Promise<void> {
  if (!hydrationPromise) {
    // Ensure AI services data is loaded and listeners are registered globally
    if (!unsubscribeAi) {
      unsubscribeAi = subscribeAiServicesSync();
    }

    hydrationPromise = Promise.all([
      useSettingsStore.getState().fetchAndSyncSettings(),
      useLayoutStore.getState().fetchAndSyncLayouts(),
      useWidgetInstanceStore.getState().fetchInstances(),
      useWidgetRegistryStore.getState().fetchRegistry(),
    ]).then(() => undefined);
  }

  return hydrationPromise;
}
