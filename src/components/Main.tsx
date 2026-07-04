import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Titlebar } from "./Titlebar";
import { Logo } from "./Logo";
import { useLayoutStore } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useWidgetRegistryStore } from "../stores/widgetRegistryStore";
import { BarHeight } from "../types/layout";
import { useTranslation } from "../lib/i18n";
import PrimarySidebar from "./PrimarySidebar";
import SecondarySidebar from "./SecondarySidebar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, LayoutGrid, CheckSquare, Calendar, Monitor, Plus, MonitorOff, Trash2, Maximize2, Move, Timer, Compass, Layers, Paintbrush } from 'lucide-react';
import { ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor } from "@fluentui/react-icons";
import WidgetSettingsPanel from "./WidgetSettingsPanel";
import GlobalWidgetSettingsPanel from "./GlobalWidgetSettingsPanel";
import { DesktopWidget } from "../types/layout";
import { AddWidgetModal } from "./AddWidgetModal";
import { Squircle } from "./ui/Squircle";
import { TipCard } from "./ui/TipCard";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CutoutProvider } from "./ui/CutoutProvider";
import { NumberInput } from "./ui/NumberInput";

const FluentIconMap: Record<string, React.ComponentType<any>> = {
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor
};

export default function Main() {
  const { layouts, currentLayout } = useLayoutStore();
  const { settings, updateSettings } = useSettingsStore();
  const { registry } = useWidgetRegistryStore();
  const { t, language } = useTranslation();

  const currentData = layouts[currentLayout];
  const allMonitors = currentData?.monitors || [];
  const monitors = allMonitors.filter(m => !m.is_disconnected);

  const [activeTab, setActiveTab] = useState<"home" | "settings" | "layout" | "appearance" | "widgets_library">("layout");
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "bar" | "widgets">("general");
  const [addWidgetTarget, setAddWidgetTarget] = useState<{ context: "bar"; sectionId: string } | { context: "widgetArea" } | null>(null);
  const [editingWidget, setEditingWidget] = useState<DesktopWidget | null>(null);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const [layoutInnerTab, setLayoutInnerTab] = useState<"bar" | "widgets">("bar");
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "layout" && !selectedMonitorId && monitors.length > 0) {
      setSelectedMonitorId(monitors[0].id);
    }
  }, [activeTab, monitors, selectedMonitorId]);

  const handleToggleTheme = (checked: boolean) => {
    updateSettings({ theme: checked ? "dark" : "light" });
  };

  const handleMonitorToggle = async (monitorId: string, type: "bar" | "widgetArea", checked: boolean) => {
    const monitor = monitors.find(m => m.id === monitorId);
    if (!monitor) return;

    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);

    if (type === "bar") {
      newLayouts[currentLayout].monitors[monitorIndex].has_bar = checked;

      if (checked) {
        const barId = await invoke('create_bar', { monitorId, height: settings.barHeight || BarHeight.Medium }).catch(console.error);
        if (typeof barId === 'string') {
          // We don't strictly need to store barId since we close by monitorId now, 
          // but we can leave the array init
        }
      } else {
        await invoke('remove_bar', { monitorId }).catch(console.error);
      }
      useLayoutStore.getState().setLayouts(newLayouts);
    } else {
      newLayouts[currentLayout].monitors[monitorIndex].has_widget_area = checked;

      if (checked) {
        const areaId = await invoke('create_widget_area', { monitorId }).catch(console.error);
        if (typeof areaId === 'string') {
          // Empty init
        }
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

  const handleAddSection = (monitorId: string) => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    if (!newLayouts[currentLayout].monitors[monitorIndex].barSections) {
      newLayouts[currentLayout].monitors[monitorIndex].barSections = [];
    }
    newLayouts[currentLayout].monitors[monitorIndex].barSections.push({
      id: `section_${Date.now()}`,
      name: `Section ${newLayouts[currentLayout].monitors[monitorIndex].barSections.length + 1}`,
      widgets: []
    });
    useLayoutStore.getState().setLayouts(newLayouts);
  };

  const handleRemoveSection = (monitorId: string, sectionId: string) => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    if (newLayouts[currentLayout].monitors[monitorIndex].barSections) {
      newLayouts[currentLayout].monitors[monitorIndex].barSections = newLayouts[currentLayout].monitors[monitorIndex].barSections!.filter(s => s.id !== sectionId);
    }
    useLayoutStore.getState().setLayouts(newLayouts);
  };

  const handleUpdateBarConfig = (monitorId: string, updates: { barJustify?: any, barWidgetSpacing?: number }) => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    newLayouts[currentLayout].monitors[monitorIndex] = {
      ...newLayouts[currentLayout].monitors[monitorIndex],
      ...updates
    };
    useLayoutStore.getState().setLayouts(newLayouts);
  };

  return (
    <CutoutProvider>
      <div className="h-screen flex flex-col bg-transparent text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden select-none" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <Titlebar />

        <div className="flex flex-1 overflow-hidden">
          {/* Primary & Secondary Sidebars */}
          <PrimarySidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          <SecondarySidebar
            activeTab={activeTab}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            selectedMonitorId={selectedMonitorId}
            setSelectedMonitorId={setSelectedMonitorId}
            selectedWidgetType={selectedWidgetType}
            setSelectedWidgetType={setSelectedWidgetType}
            monitors={monitors}
          />

          {/* Content Area */}
          <div className="flex-1 bg-zinc-100/20 dark:bg-zinc-900/20 p-6 z-0 flex flex-col min-h-0 overflow-hidden">
            {activeTab === "home" && (
              <div className="w-full h-full animate-in fade-in zoom-in-95 duration-300 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2 flex flex-col gap-6 pb-6 pr-2 -mr-2">
                {/* Banner */}
                <Squircle
                  cornerRadius={24}
                  borderWidth={1}
                  borderClassName="text-zinc-500/25 dark:text-zinc-700/30"
                  className="w-full bg-zinc-200 dark:bg-zinc-800 text-white p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shrink-0 overflow-hidden"
                >
                  {/* Decorative Blur Circles for Mesh Gradient */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-16 -left-16 w-56 h-56 bg-blue-500 rounded-full filter blur-[70px] opacity-40 mix-blend-screen"></div>
                    <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-emerald-500 rounded-full filter blur-[80px] opacity-30 mix-blend-screen"></div>
                    <div className="absolute top-1/4 -right-16 w-56 h-56 bg-purple-500 rounded-full filter blur-[70px] opacity-40 mix-blend-screen"></div>
                  </div>

                  <div className="flex flex-col gap-2 text-center md:text-start max-w-lg relative z-10">
                    <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">WidgBar Desktop</span>
                    <h1 className="text-3xl font-extrabold tracking-tight">{t("bannerWelcome")}</h1>
                    <p className="text-sm text-zinc-300 leading-relaxed mt-1">{t("bannerDesc")}</p>
                  </div>
                  <div className="shrink-0 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner relative z-10">
                    <Logo className="w-20 h-20 drop-shadow-2xl brightness-110" />
                  </div>
                </Squircle>

                {/* Suggestions Section */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 px-1">
                    {t("tipsSectionTitle")}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TipCard
                      icon={Compass}
                      iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20"
                      iconColorClass="text-indigo-500"
                      title={t("tipSnappingTitle")}
                      description={t("tipSnappingDesc")}
                    />
                    <TipCard
                      icon={LayoutGrid}
                      iconBgClass="bg-purple-500/10 dark:bg-purple-500/20"
                      iconColorClass="text-purple-500"
                      title={t("tipEditModeTitle")}
                      description={t("tipEditModeDesc")}
                    />
                    <TipCard
                      icon={Layers}
                      iconBgClass="bg-pink-500/10 dark:bg-pink-500/20"
                      iconColorClass="text-pink-500"
                      title={t("tipDualPlacementTitle")}
                      description={t("tipDualPlacementDesc")}
                    />
                    <TipCard
                      icon={Paintbrush}
                      iconBgClass="bg-rose-500/10 dark:bg-rose-500/20"
                      iconColorClass="text-rose-500"
                      title={t("tipAestheticsTitle")}
                      description={t("tipAestheticsDesc")}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "widgets_library" && selectedWidgetType && (
              <GlobalWidgetSettingsPanel widgetType={selectedWidgetType} />
            )}

            {activeTab === "widgets_library" && !selectedWidgetType && (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 gap-4 animate-in fade-in zoom-in-95 duration-300">
                <LayoutGrid className="w-16 h-16 opacity-30" />
                <h2 className="text-lg font-medium">Select a widget type from the sidebar</h2>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="max-w-xl w-full self-center h-full animate-in fade-in zoom-in-95 duration-200 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
                <h2 className="text-xl font-semibold mb-5 capitalize text-zinc-800 dark:text-zinc-100">{t(settingsTab as any)}</h2>

                {settingsTab === "general" && (
                  <div className="space-y-3">
                    <SettingCard>
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("darkMode")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("darkModeDesc")}</p>
                      </div>
                      <Switch
                        checked={settings?.theme === "dark"}
                        onCheckedChange={handleToggleTheme}
                      />
                    </SettingCard>

                    <SettingCard>
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("language")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("languageDesc")}</p>
                      </div>
                      <Select
                        value={settings?.language || "en"}
                        onValueChange={(val) => updateSettings({ language: val })}
                      >
                        <SelectTrigger className="w-36 h-8 px-3 text-xs bg-transparent" dir={language === 'fa' ? 'rtl' : 'ltr'}>
                          <SelectValue placeholder={t("language")} />
                        </SelectTrigger>
                        <SelectContent dir={language === 'fa' ? 'rtl' : 'ltr'}>
                          <SelectGroup>
                            <SelectItem value="en" className="text-xs">English</SelectItem>
                            <SelectItem value="fa" className="text-xs">فارسی</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </SettingCard>

                    <SettingCard>
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("barAnimate")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("barAnimateDesc")}</p>
                      </div>
                      <Switch
                        checked={settings?.barAnimate !== false}
                        onCheckedChange={(checked) => updateSettings({ barAnimate: checked })}
                      />
                    </SettingCard>
                  </div>
                )}

                {settingsTab === "bar" && (
                  <div className="space-y-3">
                    <SettingCard>
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("barHeight")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("barHeightDesc")}</p>
                      </div>
                      <Select
                        value={String(settings?.barHeight || BarHeight.Medium)}
                        onValueChange={(val) => updateSettings({ barHeight: Number(val) as BarHeight })}
                      >
                        <SelectTrigger className="w-36 h-8 px-3 text-xs bg-transparent" dir={language === 'fa' ? 'rtl' : 'ltr'}>
                          <SelectValue placeholder={t("barHeight")} />
                        </SelectTrigger>
                        <SelectContent dir={language === 'fa' ? 'rtl' : 'ltr'}>
                          <SelectGroup>
                            <SelectItem value={String(BarHeight.Medium)} className="text-xs">{t("medium")} (36px)</SelectItem>
                            <SelectItem value={String(BarHeight.Large)} className="text-xs">{t("large")} (48px)</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </SettingCard>
                  </div>
                )}

                {settingsTab === "widgets" && (
                  <div className="space-y-3">
                    <SettingCard>
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Snapping Margin</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">The magnetic gap distance between widgets</p>
                      </div>
                      <Select
                        value={String(settings?.snapMargin ?? 16)}
                        onValueChange={(val) => updateSettings({ snapMargin: Number(val) })}
                      >
                        <SelectTrigger className="w-36 h-8 px-3 text-xs bg-transparent" dir={language === 'fa' ? 'rtl' : 'ltr'}>
                          <SelectValue placeholder="Snap Margin" />
                        </SelectTrigger>
                        <SelectContent dir={language === 'fa' ? 'rtl' : 'ltr'}>
                          <SelectGroup>
                            <SelectItem value="0" className="text-xs">Off (0px)</SelectItem>
                            <SelectItem value="8" className="text-xs">8px</SelectItem>
                            <SelectItem value="16" className="text-xs">16px (Default)</SelectItem>
                            <SelectItem value="24" className="text-xs">24px</SelectItem>
                            <SelectItem value="32" className="text-xs">32px</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </SettingCard>
                  </div>
                )}
              </div>
            )}

            {activeTab === "layout" && selectedMonitorId && editingWidget ? (
              <div className="max-w-xl w-full self-center h-full overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
                <WidgetSettingsPanel
                  widget={editingWidget}
                  onBack={() => setEditingWidget(null)}
                />
              </div>
            ) : activeTab === "layout" && selectedMonitorId ? (
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
                    <TabsContent value="bar" className="animate-in fade-in duration-200 space-y-3 mt-0">
                      <SettingCard>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("enableBar")}</h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("enableBarDesc")}</p>
                        </div>
                        <Switch
                          checked={monitors.find(m => m.id === selectedMonitorId)?.has_bar || false}
                          disabled={monitors.find(m => m.id === selectedMonitorId)?.is_primary}
                          onCheckedChange={(checked) => handleMonitorToggle(selectedMonitorId, "bar", checked)}
                        />
                      </SettingCard>

                      {monitors.find(m => m.id === selectedMonitorId)?.has_bar && (() => {
                        const currentMon = monitors.find(m => m.id === selectedMonitorId)!;
                        return (
                          <div className="space-y-4 pt-4 border-t border-zinc-500/20">
                            {/* Bar Configuration */}
                            <SettingCardNoLayout>
                              <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Layout Settings</h4>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Justify Sections</span>
                                <Select
                                  value={currentMon.barJustify || "space-between"}
                                  onValueChange={(val) => handleUpdateBarConfig(selectedMonitorId, { barJustify: val })}
                                >
                                  <SelectTrigger className="w-36 h-8 text-xs bg-transparent" dir={language === 'fa' ? 'rtl' : 'ltr'}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent dir={language === 'fa' ? 'rtl' : 'ltr'}>
                                    <SelectGroup>
                                      <SelectItem value="start" className="text-xs">Start</SelectItem>
                                      <SelectItem value="center" className="text-xs">Center</SelectItem>
                                      <SelectItem value="end" className="text-xs">End</SelectItem>
                                      <SelectItem value="space-between" className="text-xs">Space Between</SelectItem>
                                      <SelectItem value="space-around" className="text-xs">Space Around</SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-500/10">
                                <span className="text-sm font-medium">Widget Spacing (px)</span>
                                <NumberInput
                                  value={currentMon.barWidgetSpacing ?? 8}
                                  min={0}
                                  max={64}
                                  onChange={(val) => handleUpdateBarConfig(selectedMonitorId, { barWidgetSpacing: val })}
                                />
                              </div>

                              {["start", "end", "center"].includes(currentMon.barJustify || "space-between") && (
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-500/10">
                                  <span className="text-sm font-medium">Section Spacing (px)</span>
                                  <NumberInput
                                    value={currentMon.barSectionSpacing ?? 16}
                                    min={0}
                                    max={128}
                                    onChange={(val) => handleUpdateBarConfig(selectedMonitorId, { barSectionSpacing: val })}
                                  />
                                </div>
                              )}
                            </SettingCardNoLayout>

                            {/* Sections Header */}
                            <div className="flex items-center justify-between pt-2">
                              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bar Sections</h3>
                              <button
                                onClick={() => handleAddSection(selectedMonitorId)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Section
                              </button>
                            </div>

                            {/* Sections List */}
                            <div className="flex flex-col gap-4">
                              {(currentMon.barSections || []).map((section, sIndex) => (
                                <div key={section.id} className="border border-zinc-500/20 rounded-lg overflow-hidden flex flex-col bg-zinc-50/50 dark:bg-zinc-900/20">
                                  <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 p-2.5 border-b border-zinc-500/20">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{section.name}</span>
                                      <span className="text-[10px] text-zinc-500">{section.widgets.length} widgets</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setAddWidgetTarget({ context: "bar", sectionId: section.id })}
                                        className="flex items-center gap-1 px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Widget
                                      </button>
                                      <button onClick={() => handleRemoveSection(selectedMonitorId, section.id)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete Section">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="p-2 flex flex-col gap-1.5">
                                    {section.widgets.length === 0 ? (
                                      <div className="text-center py-4 text-xs text-zinc-500">No widgets in this section</div>
                                    ) : (
                                      section.widgets.map((widget, i) => {
                                        const wType = registry[widget.type];
                                        const IconComponent = wType ? (FluentIconMap[wType.icon] || LayoutGrid) : LayoutGrid;
                                        return (
                                          <div key={widget.id} className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-zinc-800/50 border border-zinc-500/10 shadow-sm transition-colors">
                                            <div className="flex items-center gap-3">
                                              <div className="shrink-0 flex items-center justify-center">
                                                <IconComponent className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
                                              </div>
                                              <div className="flex flex-col items-start">
                                                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200 capitalize">{widget.type}</span>
                                                <span className="text-[10px] text-zinc-500">Pos: {i + 1}</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button onClick={() => handleRemoveWidget(selectedMonitorId, widget.id, { context: "bar", sectionId: section.id })} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              ))}
                              {(currentMon.barSections?.length === 0 || !currentMon.barSections) && (
                                <div className="text-center py-6 text-sm text-zinc-500 border border-dashed border-zinc-500/30 rounded-lg">
                                  No sections added. Add a section first!
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </TabsContent>

                    <TabsContent value="widgets" className="animate-in fade-in duration-200 space-y-3 mt-0">
                      <SettingCard>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("enableWidgetArea")}</h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("enableWidgetAreaDesc")}</p>
                        </div>
                        <Switch
                          checked={monitors.find(m => m.id === selectedMonitorId)?.has_widget_area || false}
                          onCheckedChange={(checked) => handleMonitorToggle(selectedMonitorId, "widgetArea", checked)}
                        />
                      </SettingCard>

                      {monitors.find(m => m.id === selectedMonitorId)?.has_widget_area && (
                        <div className="space-y-3 pt-4 border-t border-zinc-500/20">
                          <SettingCard>
                            <div>
                              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Edit Mode</h3>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">Unlock widgets to move and resize them</p>
                            </div>
                            <Switch
                              checked={monitors.find(m => m.id === selectedMonitorId)?.isEditMode || false}
                              onCheckedChange={(checked) => {
                                const newLayouts = { ...layouts };
                                const mIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === selectedMonitorId);
                                if (mIndex > -1) {
                                  newLayouts[currentLayout].monitors[mIndex].isEditMode = checked;
                                  useLayoutStore.getState().setLayouts(newLayouts);
                                }
                              }}
                            />
                          </SettingCard>

                          {/* Monitor Mini Map */}
                          <div className="w-full flex justify-center py-2">
                            <div
                              className="relative bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-inner max-w-[280px] w-full"
                              style={{ aspectRatio: `${monitors.find(m => m.id === selectedMonitorId)?.width} / ${monitors.find(m => m.id === selectedMonitorId)?.height}` }}
                            >
                              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
                              {monitors.find(m => m.id === selectedMonitorId)?.widgetArea.map(w => {
                                const isHovered = w.id === hoveredWidgetId;
                                const currentMon = monitors.find(m => m.id === selectedMonitorId);
                                if (!currentMon) return null;
                                const scale = (currentMon.scale_factor || 1) * window.devicePixelRatio;
                                const mWidth = currentMon.width / scale;
                                const mHeight = currentMon.height / scale;

                                return (
                                  <div
                                    key={w.id}
                                    className={`absolute rounded-[2px] transition-all duration-200 border border-zinc-500/30 ${isHovered ? 'bg-indigo-500/50 z-10 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-400/20 dark:bg-zinc-600/30'}`}
                                    style={{
                                      left: `${(w.x / mWidth) * 100}%`,
                                      top: `${(w.y / mHeight) * 100}%`,
                                      width: `${(w.width / mWidth) * 100}%`,
                                      height: `${(w.height / mHeight) * 100}%`
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Desktop Widgets</h3>
                            <button
                              onClick={() => setAddWidgetTarget({ context: "widgetArea" })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Widget
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {monitors.find(m => m.id === selectedMonitorId)?.widgetArea.map(widget => {
                              const wType = registry[widget.type];
                              const IconComponent = wType ? (FluentIconMap[wType.icon] || LayoutGrid) : LayoutGrid;
                              return (
                                <div
                                  key={widget.id}
                                  onMouseEnter={() => setHoveredWidgetId(widget.id)}
                                  onMouseLeave={() => setHoveredWidgetId(null)}
                                >
                                  <SettingCard>
                                    <div className="flex items-center gap-3">
                                      <div className="shrink-0 flex items-center justify-center">
                                        <IconComponent className="w-8 h-8 text-zinc-700 dark:text-zinc-200" />
                                      </div>
                                      <div className="flex flex-col items-start">
                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 capitalize">{widget.type}</span>
                                        <span className="text-[10px] text-zinc-500">
                                          Size: {Math.round(widget.width)}x{Math.round(widget.height)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setEditingWidget(widget)}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                                        title="Settings"
                                      >
                                        <SettingsIcon className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleRemoveWidget(selectedMonitorId, widget.id, { context: "widgetArea" })} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </SettingCard>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* The new Custom Popup Modal */}
      <AddWidgetModal
        isOpen={addWidgetTarget !== null}
        onClose={() => setAddWidgetTarget(null)}
        context={addWidgetTarget?.context || "widgetArea"}
        onSelect={(typeName) => {
          if (addWidgetTarget && selectedMonitorId) {
            handleAddWidget(selectedMonitorId, typeName, addWidgetTarget);
          }
        }}
      />
    </CutoutProvider>
  );
}



function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
      {children}
    </div>
  );
}

function SettingCardNoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
      {children}
    </div>
  );
}