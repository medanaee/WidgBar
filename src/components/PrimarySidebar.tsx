import React from 'react';
import { HomeRegular, SettingsRegular, BoardRegular, AppsRegular } from "@fluentui/react-icons";

type ActiveTab = "home" | "settings" | "layout" | "appearance" | "widgets_library";

interface PrimarySidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
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

export default function PrimarySidebar({ activeTab, setActiveTab }: PrimarySidebarProps) {
  return (
    <div className="w-14 flex flex-col items-center py-4 bg-zinc-50/70 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-20 gap-3">
      <SidebarItem
        icon={<HomeRegular fontSize={20} />}
        active={activeTab === "home"}
        onClick={() => setActiveTab("home")}
      />
      <SidebarItem
        icon={<BoardRegular fontSize={20} />}
        active={activeTab === "layout"}
        onClick={() => setActiveTab("layout")}
      />
      <SidebarItem
        icon={<AppsRegular fontSize={20} />}
        active={activeTab === "widgets_library"}
        onClick={() => setActiveTab("widgets_library")}
      />
      <SidebarItem
        icon={<SettingsRegular fontSize={20} />}
        active={activeTab === "settings"}
        onClick={() => setActiveTab("settings")}
      />
    </div>
  );
}
