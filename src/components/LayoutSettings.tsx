import BarSettingsTab from './BarSettingsTab';
import WidgetAreaSettingsTab from './WidgetAreaSettingsTab';
import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLayoutStore } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useWidgetRegistryStore } from "../stores/widgetRegistryStore";
import { BarHeight, DesktopWidget } from "../types/layout";
import { useTranslation } from "../lib/i18n";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor } from "@fluentui/react-icons";
import WidgetSettingsPanel from "./WidgetSettingsPanel";
import AddWidgetPanel from "./AddWidgetPanel";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { NumberInput } from "./ui/NumberInput";
import { SettingCard, SettingCardNoLayout } from "./ui/SettingCard";

const FluentIconMap: Record<string, React.ComponentType<any>> = {
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor
};

export default function LayoutSettings({ selectedMonitorId }: { selectedMonitorId: string | null }) {
  const { layouts, currentLayout } = useLayoutStore();
  const { settings } = useSettingsStore();
  const { registry } = useWidgetRegistryStore();
  const { t, language } = useTranslation();

  const currentData = layouts[currentLayout];
  const allMonitors = currentData?.monitors || [];
  const monitors = allMonitors.filter(m => !m.is_disconnected);

  const [addWidgetTarget, setAddWidgetTarget] = useState<{ context: "bar"; sectionId: string } | { context: "widgetArea" } | null>(null);
  const [editingWidget, setEditingWidget] = useState<{ widget: any, context: 'bar' | 'area' } | null>(null);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const [layoutInnerTab, setLayoutInnerTab] = useState<"bar" | "widgets">("bar");

  if (!selectedMonitorId) return null;


  const handleMonitorToggle = async (monitorId: string, type: "bar" | "widgetArea", checked: boolean) => {
    const monitor = monitors.find(m => m.id === monitorId);
    if (!monitor) return;

    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);

    if (type === "bar") {
      newLayouts[currentLayout].monitors[monitorIndex].has_bar = checked;

      if (checked) {
        const barId = await invoke('create_bar', { monitorId, height: settings.barHeight || BarHeight.Medium }).catch(console.error);
      } else {
        await invoke('remove_bar', { monitorId }).catch(console.error);
      }
      useLayoutStore.getState().setLayouts(newLayouts);
    } else {
      newLayouts[currentLayout].monitors[monitorIndex].has_widget_area = checked;

      if (checked) {
        const areaId = await invoke('create_widget_area', { monitorId }).catch(console.error);
      } else {
        await invoke('remove_widget_area', { monitorId }).catch(console.error);
      }
      useLayoutStore.getState().setLayouts(newLayouts);
    }
  };

  const handleAddWidget = (monitorId: string, type_name: string, target: { context: "bar", sectionId: string } | { context: "widgetArea" }) => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    const widgetId = `widget_${Date.now()}`;
    const widgetType = registry[type_name];

    if (target.context === "bar") {
      const section = newLayouts[currentLayout].monitors[monitorIndex].barSections?.find(s => s.id === target.sectionId);
      if (section) {
        section.widgets.push({ id: widgetId, type: type_name });
      }
    } else {
      newLayouts[currentLayout].monitors[monitorIndex].widgetArea.push({
        id: widgetId,
        type: type_name,
        x: 50,
        y: 50,
        width: widgetType?.default_width || 250,
        height: widgetType?.default_height || 150
      });
    }
    useLayoutStore.getState().setLayouts(newLayouts);
  };

  const handleRemoveWidget = (monitorId: string, widgetId: string, target: { context: "bar", sectionId: string } | { context: "widgetArea" }) => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    if (target.context === "bar") {
      const section = newLayouts[currentLayout].monitors[monitorIndex].barSections?.find(s => s.id === target.sectionId);
      if (section) {
        section.widgets = section.widgets.filter(w => w.id !== widgetId);
      }
    } else {
      newLayouts[currentLayout].monitors[monitorIndex].widgetArea = newLayouts[currentLayout].monitors[monitorIndex].widgetArea.filter(w => w.id !== widgetId);
    }
    useLayoutStore.getState().setLayouts(newLayouts);
  };




  return (
    <>
      {editingWidget ? (
        <div className="max-w-xl w-full self-center h-full overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
          <WidgetSettingsPanel
            widget={editingWidget.widget}
            context={editingWidget.context}
            onBack={() => setEditingWidget(null)}
          />
        </div>
      ) : addWidgetTarget ? (
        <div className="max-w-xl w-full self-center h-full overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
          <AddWidgetPanel
            context={addWidgetTarget.context === 'bar' ? 'bar' : 'widgetArea'}
            onBack={() => setAddWidgetTarget(null)}
            onSelect={(typeName) => {
              if (selectedMonitorId) {
                handleAddWidget(selectedMonitorId, typeName, addWidgetTarget);
                setAddWidgetTarget(null);
              }
            }}
          />
        </div>
      ) : (
        <div className="max-w-xl w-full self-center h-full flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200">
          <Tabs value={layoutInnerTab} onValueChange={(v) => setLayoutInnerTab(v as "bar" | "widgets")} className="w-full flex-1 flex flex-col min-h-0" dir={language === 'fa' ? 'rtl' : 'ltr'}>
            <div className="shrink-0">
              <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-100">
                {t("monitorPrefix")} {monitors.findIndex(m => m.id === selectedMonitorId) + 1}
              </h2>
              <TabsList className="mb-4 h-8 bg-zinc-500/10 dark:bg-zinc-500/20 w-full flex">
                <TabsTrigger value="bar" className="text-xs px-4 flex-1">{t("bar")}</TabsTrigger>
                <TabsTrigger value="widgets" className="text-xs px-4 flex-1">{t("widgets")}</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2 pb-6">
              
              <BarSettingsTab
                selectedMonitorId={selectedMonitorId}
                monitors={monitors}
                settings={settings}
                registry={registry}
                t={t}
                language={language}
                handleMonitorToggle={handleMonitorToggle}
                setAddWidgetTarget={setAddWidgetTarget}
                handleRemoveWidget={handleRemoveWidget}
                setEditingWidget={setEditingWidget}
              />
              
              <WidgetAreaSettingsTab
                selectedMonitorId={selectedMonitorId}
                monitors={monitors}
                layouts={layouts}
                currentLayout={currentLayout}
                registry={registry}
                t={t}
                handleMonitorToggle={handleMonitorToggle}
                hoveredWidgetId={hoveredWidgetId}
                setHoveredWidgetId={setHoveredWidgetId}
                setAddWidgetTarget={setAddWidgetTarget}
                setEditingWidget={setEditingWidget}
                handleRemoveWidget={handleRemoveWidget}
              />

            </div>
          </Tabs>
        </div>
      )}
    </>
  );
}
