import React from 'react';
import { useTranslation } from '../lib/i18n';
import { Monitor } from '../types/layout';

type ActiveTab = "home" | "settings" | "layout" | "appearance";

interface SecondarySidebarProps {
  activeTab: ActiveTab;
  settingsTab: "general" | "bar" | "widgets";
  setSettingsTab: (tab: "general" | "bar" | "widgets") => void;
  selectedMonitorId: string | null;
  setSelectedMonitorId: (id: string | null) => void;
  monitors: Monitor[];
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

export default function SecondarySidebar({
  activeTab,
  settingsTab,
  setSettingsTab,
  selectedMonitorId,
  setSelectedMonitorId,
  monitors,
}: SecondarySidebarProps) {
  const { t } = useTranslation();

  if (activeTab === "settings") {
    return (
      <div className="w-48 flex flex-col bg-white/40 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10 animate-in fade-in slide-in-from-left-4 duration-200">
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
      <div className="w-48 flex flex-col bg-white/40 dark:bg-zinc-950/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-10 animate-in fade-in slide-in-from-left-4 duration-200">
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
