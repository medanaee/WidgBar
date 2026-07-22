import { useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUIStore } from "../../stores/uiStore";
import { BarHeight } from "../../types/layout";
import { useTranslation } from "../../lib/i18n";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SettingCard } from "../ui/SettingCard";
import { Slider } from "../ui/slider";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";

export default function SettingsPanel() {
  const { settingsTab } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();
  const { t, language } = useTranslation();
  const [launchAtStartup, setLaunchAtStartup] = useState(false);

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
    <div className="max-w-xl w-full self-center h-full animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
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
  );
}
