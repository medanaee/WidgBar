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
import { SettingCard, SettingCardNoLayout } from "./ui/SettingCard";
import LayoutSettings from "./LayoutSettings";
import { Slider } from "./ui/slider";
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

  const handleUpdateBarConfig = (monitorId: string, updates: any) => {
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

                    <SettingCard>
                      <div className="flex-grow">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("widgetBgOpacity")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("widgetBgOpacityDesc")}</p>
                        <div className="flex items-center gap-4 mt-3 w-full">
                          <Slider
                            value={[settings?.widgetBgOpacity ?? 80]}
                            onValueChange={(val) => updateSettings({ widgetBgOpacity: val[0] })}
                            min={0}
                            max={100}
                            step={1}
                            className="flex-grow"
                          />
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-10 text-right">
                            {settings?.widgetBgOpacity ?? 80}%
                          </span>
                        </div>
                      </div>
                    </SettingCard>
                  </div>
                )}
              </div>
            )}

            {activeTab === "layout" && <LayoutSettings selectedMonitorId={selectedMonitorId} />}
          </div>
        </div>
      </div>

      </CutoutProvider>
  );
}