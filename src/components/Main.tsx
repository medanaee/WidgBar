import { useEffect, useState } from "react";
import { Titlebar } from "./Titlebar";
import { useLayoutStore } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { BarHeight } from "../types/layout";
import { useTranslation } from "../lib/i18n";
import PrimarySidebar from "./PrimarySidebar";
import SecondarySidebar from "./SecondarySidebar";
import { Switch } from "@/components/ui/switch";
import { LayoutGrid } from 'lucide-react';
import GlobalWidgetSettingsPanel from "./GlobalWidgetSettingsPanel";
import HomeTab from "./tabs/HomeTab";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CutoutProvider } from "./ui/CutoutProvider";
import { SettingCard } from "./ui/SettingCard";
import LayoutSettingsTab from "./tabs/LayoutSettingsTab";
import AiServicesTab from "./tabs/AiServicesTab";
import { Slider } from "./ui/slider";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";


export default function Main() {
  const { layouts, currentLayout } = useLayoutStore();
  const { settings, updateSettings } = useSettingsStore();
  const { t, language } = useTranslation();

  const currentData = layouts[currentLayout];
  const allMonitors = currentData?.monitors || [];
  const monitors = allMonitors.filter(m => !m.is_disconnected);

  const [activeTab, setActiveTab] = useState<"home" | "settings" | "layout" | "appearance" | "widgets_library">("layout");
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "bar" | "widgets">("general");
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);

  useEffect(() => {
    if (activeTab === "layout" && !selectedMonitorId && monitors.length > 0) {
      setSelectedMonitorId(monitors[0].id);
    }
  }, [activeTab, monitors, selectedMonitorId]);

  useEffect(() => {
    isAutostartEnabled()
      .then(setLaunchAtStartup)
      .catch(console.error);
  }, []);

  const handleToggleTheme = (checked: boolean) => {
    updateSettings({ theme: checked ? "dark" : "light" });
  };

  const handleToggleStartup = async (checked: boolean) => {
    try {
      if (checked) await enableAutostart();
      else await disableAutostart();
      setLaunchAtStartup(checked);
    } catch (e) {
      console.error("Failed to update launch at startup", e);
    }
  };

  return (
    <CutoutProvider>
      <div className="h-screen flex flex-col bg-transparent text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden select-none" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <Titlebar />

        <div className="flex flex-1 overflow-hidden">
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
            {activeTab === "home" && <HomeTab />}

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
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("launchAtStartup")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("launchAtStartupDesc")}</p>
                      </div>
                      <Switch
                        checked={launchAtStartup}
                        onCheckedChange={handleToggleStartup}
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

                    <SettingCard>
                      <div className="flex-grow">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("barBgOpacity")}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("barBgOpacityDesc")}</p>
                        <div className="flex items-center gap-4 mt-3 w-full">
                          <Slider
                            value={[settings?.barBgOpacity ?? 80]}
                            onValueChange={(val) => updateSettings({ barBgOpacity: val[0] })}
                            min={0}
                            max={100}
                            step={1}
                            className="flex-grow"
                          />
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-10 text-right">
                            {settings?.barBgOpacity ?? 80}%
                          </span>
                        </div>
                      </div>
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

            {activeTab === "layout" && <LayoutSettingsTab selectedMonitorId={selectedMonitorId} />}
            {activeTab === "ai_services" && <AiServicesTab />}
          </div>
        </div>
      </div>

    </CutoutProvider>
  );
}