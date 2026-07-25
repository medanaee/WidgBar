import { invoke } from '@tauri-apps/api/core';
import { useLayoutStore } from '../stores/layoutStore';
import { useWidgetInstanceStore } from '../stores/widgetInstanceStore';

export interface BarPresetWidget {
  widgetType: string;
  config: Record<string, any>;
}

export interface BarPresetSection {
  id?: string;
  name?: string;
  widgetSpacing?: number;
  widgets: BarPresetWidget[];
}

export interface BarPresetExport {
  schemaVersion: 1;
  type: 'bar';
  exportedAt: string;
  barSections: BarPresetSection[];
  barJustify?: string;
  barSectionSpacing?: number;
  showMainWindowButton?: boolean;
  barSeparator?: string;
}

export interface DesktopAreaPresetWidget {
  widgetType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, any>;
}

export interface DesktopAreaPresetExport {
  schemaVersion: 1;
  type: 'area';
  exportedAt: string;
  widgets: DesktopAreaPresetWidget[];
}

export type PresetExport = BarPresetExport | DesktopAreaPresetExport;

async function saveJsonFile(filename: string, content: string) {
  try {
    await invoke('save_preset_dialog', { defaultName: filename, content });
  } catch (e) {
    console.error('Failed to save preset via dialog:', e);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export async function openJsonFile(): Promise<string | null> {
  try {
    return await invoke<string | null>('open_preset_dialog');
  } catch (e) {
    console.error('Failed to open preset dialog:', e);
    return null;
  }
}

function generateNewWidgetId(type: string): string {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Export Bar configuration and widgets for a specific monitor.
 */
export async function exportBarPreset(monitorId: string): Promise<boolean> {
  const { layouts, currentLayout } = useLayoutStore.getState();
  const currentLayoutData = layouts[currentLayout];
  if (!currentLayoutData) return false;

  const monitor = currentLayoutData.monitors.find((m) => m.id === monitorId);
  if (!monitor) return false;

  const instanceStore = useWidgetInstanceStore.getState();

  const sections: BarPresetSection[] = (monitor.barSections || []).map((sec) => ({
    id: sec.id,
    name: sec.name,
    widgetSpacing: sec.widgetSpacing,
    widgets: (sec.widgets || []).map((w: any) => ({
      widgetType: w.type || w.widgetType || 'unknown',
      config: instanceStore.instances[w.id] ? { ...instanceStore.instances[w.id] } : {},
    })),
  }));

  const exportData: BarPresetExport = {
    schemaVersion: 1,
    type: 'bar',
    exportedAt: new Date().toISOString(),
    barSections: sections,
    barJustify: monitor.barJustify,
    barSectionSpacing: monitor.barSectionSpacing,
    showMainWindowButton: monitor.showMainWindowButton,
    barSeparator: monitor.barSeparator,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  await saveJsonFile(`widgbar-preset-bar-${monitorId}.json`, jsonStr);
  return true;
}

/**
 * Export Desktop Area widgets for a specific monitor.
 */
export async function exportAreaPreset(monitorId: string): Promise<boolean> {
  const { layouts, currentLayout } = useLayoutStore.getState();
  const currentLayoutData = layouts[currentLayout];
  if (!currentLayoutData) return false;

  const monitor = currentLayoutData.monitors.find((m) => m.id === monitorId);
  if (!monitor) return false;

  const instanceStore = useWidgetInstanceStore.getState();

  const areaWidgets: DesktopAreaPresetWidget[] = (monitor.widgetArea || []).map((w: any) => ({
    widgetType: w.type || w.widgetType || 'unknown',
    x: w.x ?? 0,
    y: w.y ?? 0,
    width: w.width ?? 200,
    height: w.height ?? 150,
    config: instanceStore.instances[w.id] ? { ...instanceStore.instances[w.id] } : {},
  }));

  const exportData: DesktopAreaPresetExport = {
    schemaVersion: 1,
    type: 'area',
    exportedAt: new Date().toISOString(),
    widgets: areaWidgets,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  await saveJsonFile(`widgbar-preset-area-${monitorId}.json`, jsonStr);
  return true;
}

/**
 * Import a Bar preset JSON string into a target monitor's Bar.
 * Creates brand new widget instance IDs and populates them.
 */
export function importBarPreset(monitorId: string, jsonString: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonString) as BarPresetExport;
    if (data.type !== 'bar') {
      return { success: false, message: 'Invalid preset type. Expected a Bar preset file.' };
    }

    const { layouts, currentLayout, setLayouts } = useLayoutStore.getState();
    const layoutsCopy = JSON.parse(JSON.stringify(layouts));
    const layoutData = layoutsCopy[currentLayout];
    if (!layoutData) return { success: false, message: 'Current layout not found.' };

    const monitorIndex = layoutData.monitors.findIndex((m: any) => m.id === monitorId);
    if (monitorIndex === -1) return { success: false, message: 'Target monitor not found.' };

    const instanceStore = useWidgetInstanceStore.getState();

    const newSections = (data.barSections || []).map((sec, secIdx) => {
      const sectionId = sec.id || `section_${Date.now()}_${secIdx}`;
      const newWidgets = (sec.widgets || []).map((w) => {
        const newWidgetId = generateNewWidgetId(w.widgetType);
        if (w.config && Object.keys(w.config).length > 0) {
          instanceStore.updateInstance(newWidgetId, w.config, true);
        }
        return {
          id: newWidgetId,
          type: w.widgetType,
        };
      });

      return {
        id: sectionId,
        name: sec.name || `Section ${secIdx + 1}`,
        widgetSpacing: sec.widgetSpacing ?? 8,
        widgets: newWidgets,
      };
    });

    const targetMonitor = layoutData.monitors[monitorIndex];
    targetMonitor.barSections = newSections;
    if (data.barJustify) targetMonitor.barJustify = data.barJustify;
    if (data.barSectionSpacing !== undefined) targetMonitor.barSectionSpacing = data.barSectionSpacing;
    if (data.showMainWindowButton !== undefined) targetMonitor.showMainWindowButton = data.showMainWindowButton;
    if (data.barSeparator) targetMonitor.barSeparator = data.barSeparator;

    setLayouts(layoutsCopy, true);
    return { success: true, message: 'Bar preset imported successfully!' };
  } catch (err: any) {
    return { success: false, message: `Failed to import preset: ${err?.message || err}` };
  }
}

/**
 * Import a Desktop Area preset JSON string into a target monitor's Desktop Area.
 * Creates brand new widget instance IDs and populates them.
 */
export function importAreaPreset(monitorId: string, jsonString: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonString) as DesktopAreaPresetExport;
    if (data.type !== 'area') {
      return { success: false, message: 'Invalid preset type. Expected a Desktop Area preset file.' };
    }

    const { layouts, currentLayout, setLayouts } = useLayoutStore.getState();
    const layoutsCopy = JSON.parse(JSON.stringify(layouts));
    const layoutData = layoutsCopy[currentLayout];
    if (!layoutData) return { success: false, message: 'Current layout not found.' };

    const monitorIndex = layoutData.monitors.findIndex((m: any) => m.id === monitorId);
    if (monitorIndex === -1) return { success: false, message: 'Target monitor not found.' };

    const instanceStore = useWidgetInstanceStore.getState();

    const newDesktopWidgets = (data.widgets || []).map((w) => {
      const newWidgetId = generateNewWidgetId(w.widgetType);
      if (w.config && Object.keys(w.config).length > 0) {
        instanceStore.updateInstance(newWidgetId, w.config, true);
      }
      return {
        id: newWidgetId,
        type: w.widgetType,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
      };
    });

    const targetMonitor = layoutData.monitors[monitorIndex];
    targetMonitor.widgetArea = newDesktopWidgets;

    setLayouts(layoutsCopy, true);
    return { success: true, message: 'Desktop Area preset imported successfully!' };
  } catch (err: any) {
    return { success: false, message: `Failed to import preset: ${err?.message || err}` };
  }
}
