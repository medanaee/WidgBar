import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Titlebar } from "./Titlebar";
import { Logo } from "./Logo";
import { useLayoutStore } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useWidgetRegistryStore } from "../stores/widgetRegistryStore";
import { BarHeight } from "../types/layout";
import { useTranslation } from "../lib/i18n";
import {
  HomeRegular,
  SettingsRegular,
  BoardRegular,
} from "@fluentui/react-icons";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, LayoutGrid, CheckSquare, Calendar, Monitor, Plus, MonitorOff, Trash2, Maximize2, Move, Timer } from 'lucide-react';
import { ClockRegular } from "@fluentui/react-icons";
import WidgetSettingsPanel from "./WidgetSettingsPanel";
import { DesktopWidget } from "../types/layout";
import { AddWidgetModal } from "./AddWidgetModal";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CutoutProvider } from "./ui/CutoutProvider";

const FluentIconMap: Record<string, React.ComponentType<any>> = {
  ClockRegular,
  CheckSquare,
  Calendar,
  Timer
};

export default function Main() {
  const { layouts, currentLayout } = useLayoutStore();
  const { settings, updateSettings } = useSettingsStore();
  const { registry } = useWidgetRegistryStore();
  const { t, language } = useTranslation();

  const currentData = layouts[currentLayout];
  const allMonitors = currentData?.monitors || [];
  const monitors = allMonitors.filter(m => !m.is_disconnected);

  const [activeTab, setActiveTab] = useState<"layout" | "appearance">("layout");
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "bar" | "widgets">("general");
  const [addWidgetTarget, setAddWidgetTarget] = useState<"bar" | "widgetArea" | null>(null);
  const [editingWidget, setEditingWidget] = useState<DesktopWidget | null>(null);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const [layoutInnerTab, setLayoutInnerTab] = useState<"bar" | "widgets">("bar");

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

  const handleAddWidget = (monitorId: string, type_name: string, context: "bar" | "widgetArea") => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    const widgetId = `widget_${Date.now()}`;
    const widgetType = registry[type_name];

    if (context === "bar") {
      newLayouts[currentLayout].monitors[monitorIndex].bar.push({ id: widgetId, type: type_name });
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

  const handleRemoveWidget = (monitorId: string, widgetId: string, context: "bar" | "widgetArea") => {
    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === monitorId);
    if (monitorIndex === -1) return;

    if (context === "bar") {
      newLayouts[currentLayout].monitors[monitorIndex].bar = newLayouts[currentLayout].monitors[monitorIndex].bar.filter(w => w.id !== widgetId);
    } else {
      newLayouts[currentLayout].monitors[monitorIndex].widgetArea = newLayouts[currentLayout].monitors[monitorIndex].widgetArea.filter(w => w.id !== widgetId);
    }
    useLayoutStore.getState().setLayouts(newLayouts);
  };

  return (
    <CutoutProvider>
      <div className="h-screen flex flex-col bg-transparent text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden select-none" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <Titlebar />

        <div className="flex flex-1 overflow-hidden">
          {/* Primary Sidebar */}
          <div className="w-14 flex flex-col items-center py-4 bg-zinc-50/70 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-20 gap-3">
            <SidebarItem
              icon={<HomeRegular fontSize={20} />}
              active={activeTab === "home"}
              onClick={() => setActiveTab("home")}
            />
            <SidebarItem
              icon={<SettingsRegular fontSize={20} />}
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            />
            <SidebarItem
              icon={<BoardRegular fontSize={20} />}
              active={activeTab === "layout"}
              onClick={() => setActiveTab("layout")}
            />
          </div>

          {/* Secondary Sidebar - Settings */}
          {activeTab === "settings" && (
            <div className="w-48 flex flex-col bg-white/40 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10 animate-in fade-in slide-in-from-left-4 duration-200">
              <div className="p-4 font-semibold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">{t("settings")}</div>
              <div className="flex flex-col px-2 space-y-0.5">
                <SubMenuItem active={settingsTab === "general"} onClick={() => setSettingsTab("general")}>{t("general")}</SubMenuItem>
                <SubMenuItem active={settingsTab === "bar"} onClick={() => setSettingsTab("bar")}>{t("bar")}</SubMenuItem>
                <SubMenuItem active={settingsTab === "widgets"} onClick={() => setSettingsTab("widgets")}>{t("widgets")}</SubMenuItem>
              </div>
            </div>
          )}

          {/* Secondary Sidebar - Layout */}
          {activeTab === "layout" && (
            <div className="w-48 flex flex-col bg-white/40 dark:bg-zinc-950/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10 animate-in fade-in slide-in-from-left-4 duration-200">
              <div className="p-4 font-semibold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">{t("monitors")}</div>
              <div className="flex flex-col px-2 space-y-0.5 overflow-y-auto">
                {monitors.map((m, index) => (
                  <SubMenuItem
                    key={m.id}
                    active={selectedMonitorId === m.id}
                    onClick={() => setSelectedMonitorId(m.id)}
                  >
                    {t("monitorPrefix")} {index + 1} {m.is_primary ? `(${t("primary")})` : ""}
                  </SubMenuItem>
                ))}
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 bg-zinc-100/20 dark:bg-zinc-900/20 p-6 z-0 flex flex-col min-h-0 overflow-hidden">
            {activeTab === "home" && (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 gap-4 animate-in fade-in zoom-in-95 duration-300 overflow-y-auto custom-scrollbar">
                <Logo className="w-20 h-20 opacity-80" />
                <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">{t("welcome")}</h1>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="max-w-xl mx-auto w-full h-full animate-in fade-in zoom-in-95 duration-200 overflow-y-auto custom-scrollbar pr-2 -mr-2">
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
              <div className="max-w-xl mx-auto w-full h-full overflow-y-auto custom-scrollbar pr-2 -mr-2">
                <WidgetSettingsPanel 
                  widget={editingWidget} 
                  onBack={() => setEditingWidget(null)} 
                />
              </div>
            ) : activeTab === "layout" && selectedMonitorId && !editingWidget ? (
              <div className="max-w-xl mx-auto w-full h-full flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200">
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

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 pb-6">
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

                    {monitors.find(m => m.id === selectedMonitorId)?.has_bar && (
                      <div className="space-y-3 pt-4 border-t border-zinc-500/20">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bar Widgets</h3>
                          <button
                            onClick={() => setAddWidgetTarget("bar")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Widget
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {monitors.find(m => m.id === selectedMonitorId)?.bar.map((widget, i) => {
                            const wType = registry[widget.type];
                            const IconComponent = wType ? (FluentIconMap[wType.icon] || LayoutGrid) : LayoutGrid;
                            return (
                              <div key={widget.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-500/20 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 rounded-md bg-zinc-200/50 dark:bg-zinc-800">
                                    <IconComponent className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 capitalize">{widget.type}</span>
                                    <span className="text-[10px] text-zinc-500">Position: {i + 1}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors" title="Settings (Coming soon)">
                                    <SettingsIcon className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleRemoveWidget(selectedMonitorId, widget.id, "bar")} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                              const mWidth = currentMon.width;
                              const mHeight = currentMon.height;
                              
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
                            onClick={() => setAddWidgetTarget("widgetArea")}
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
                                      <div className="p-1.5 rounded-md bg-zinc-200/50 dark:bg-zinc-800">
                                        <IconComponent className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
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
                                      <button onClick={() => handleRemoveWidget(selectedMonitorId, widget.id, "widgetArea")} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete">
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
        context={addWidgetTarget || "widgetArea"}
        onSelect={(typeName) => {
          if (addWidgetTarget && selectedMonitorId) {
            handleAddWidget(selectedMonitorId, typeName, addWidgetTarget);
          }
        }}
      />
    </CutoutProvider>
  );
}

function SidebarItem({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg flex items-center justify-center transition-all duration-200 ${active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/50"
        }`}
    >
      {icon}
    </button>
  );
}

function SubMenuItem({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-start text-xs font-medium transition-all duration-150 ${active
        ? "bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-900 dark:text-zinc-100"
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/5 dark:hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
    >
      {children}
    </button>
  );
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
      {children}
    </div>
  );
}