import React, { useEffect } from 'react';
import { useTranslation, TranslationKey } from '../lib/i18n';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useUIStore } from '../stores/uiStore';
import { WidgetIcon } from './WidgetIcon';

function SubMenuItem({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-start text-xs rounded-lg font-medium transition-all duration-150 flex items-center gap-2 ${active
        ? "bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-900 dark:text-zinc-100"
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/5 dark:hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
    >
      {children}
    </button>
  );
}

function WidgetListItem({ 
  w, 
  isSelected, 
  onClick 
}: { 
  w: any, 
  isSelected: boolean, 
  onClick: () => void 
}) {
  const { t } = useTranslation();
  
  return (
    <button
      onClick={onClick}
      className={`w-full px-2.5 py-2 text-start rounded-2xl transition-all duration-150 flex items-start gap-2.5 ${isSelected
        ? "bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-900 dark:text-zinc-100"
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/5 dark:hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
    >
      <div className="shrink-0 flex items-center justify-center relative z-10">
        <WidgetIcon type={w.type_name} className="w-7 h-7 opacity-90 drop-shadow-sm" />
      </div>
      <div className="flex flex-col min-w-0 relative z-10">
        <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 capitalize leading-tight">
          {t(w.nameKey as TranslationKey)}
        </span>
        {w.descriptionKey && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal line-clamp-2 mt-0.5">
            {t(w.descriptionKey as TranslationKey)}
          </span>
        )}
      </div>
    </button>
  );
}

export default function SecondarySidebar() {
  const { t } = useTranslation();
  const { registry } = useWidgetRegistryStore();
  const { layouts, currentLayout } = useLayoutStore();
  const {
    activeTab,
    settingsTab,
    setSettingsTab,
    selectedMonitorId,
    setSelectedMonitorId,
    selectedWidgetType,
    setSelectedWidgetType,
  } = useUIStore();

  const currentData = layouts[currentLayout];
  const allMonitors = currentData?.monitors || [];
  const monitors = allMonitors.filter(m => !m.is_disconnected);

  useEffect(() => {
    if (activeTab === "layout" && !selectedMonitorId && monitors.length > 0) {
      setSelectedMonitorId(monitors[0].id);
    }
  }, [activeTab, monitors, selectedMonitorId, setSelectedMonitorId]);

  if (activeTab === "widgets_library") {
    return (
      <div className="w-72 flex flex-col bg-white/40 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10">
        <div className="p-4 font-semibold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
          Widgets Library
        </div>
        <div className="flex flex-col px-2 space-y-0.5">
          {Object.values(registry).map(w => (
            <WidgetListItem
              key={w.type_name}
              w={w}
              isSelected={selectedWidgetType === w.type_name}
              onClick={() => setSelectedWidgetType(w.type_name)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === "settings") {
    return (
      <div className="w-48 flex flex-col bg-white/40 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10">
        <div className="p-4 font-semibold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
          {t("settings")}
        </div>
        <div className="flex flex-col px-2 space-y-0.5">
          <SubMenuItem active={settingsTab === "general"} onClick={() => setSettingsTab("general")}>
            {t("general")}
          </SubMenuItem>
          <SubMenuItem active={settingsTab === "bar"} onClick={() => setSettingsTab("bar")}>
            {t("bar")}
          </SubMenuItem>
          <SubMenuItem active={settingsTab === "widgets"} onClick={() => setSettingsTab("widgets")}>
            {t("widgets")}
          </SubMenuItem>
        </div>
      </div>
    );
  }

  if (activeTab === "layout") {
    return (
      <div className="w-48 flex flex-col bg-white/40 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10">
        <div className="p-4 font-semibold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
          {t("monitors")}
        </div>
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
    );
  }

  return null;
}
