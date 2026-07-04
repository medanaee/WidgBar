import React, { useState } from 'react';
import { 
  HomeRegular, 
  SettingsRegular, 
  BoardRegular, 
  AppsRegular, 
  PowerRegular,
  Navigation20Regular
} from "@fluentui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../lib/i18n";
import { cn } from "../lib/utils";

type ActiveTab = "home" | "settings" | "layout" | "appearance" | "widgets_library";

interface PrimarySidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

function SidebarItem({ 
  icon, 
  label, 
  active, 
  onClick, 
  isExpanded, 
  className 
}: { 
  icon: React.ReactNode, 
  label?: string, 
  active: boolean, 
  onClick: () => void, 
  isExpanded: boolean, 
  className?: string 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg flex items-center transition-all duration-300 cursor-pointer overflow-hidden whitespace-nowrap px-[7px] h-[34px] w-full",
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-500/20",
        className
      )}
    >
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
        {icon}
      </div>
      <span 
        className={cn(
          "text-xs font-semibold transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden text-start",
          isExpanded 
            ? "opacity-100 translate-x-0 ltr:ml-2.5 rtl:mr-2.5 max-w-[120px]" 
            : "opacity-0 ltr:-translate-x-2 rtl:translate-x-2 ltr:ml-0 rtl:mr-0 max-w-0"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export default function PrimarySidebar({ activeTab, setActiveTab }: PrimarySidebarProps) {
  const { t, language } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExitApp = () => {
    invoke('exit_app').catch(console.error);
  };

  return (
    <div 
      className={cn(
        "flex flex-col py-1.5 bg-zinc-50/70 dark:bg-zinc-900/40 border-x border-zinc-200/50 dark:border-zinc-500/10 shrink-0 z-20 gap-1 h-full transition-[width] duration-300 ease-in-out px-1.5 items-stretch",
        isExpanded ? "w-44" : "w-12"
      )}
    >
      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="rounded-lg flex items-center text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-300 cursor-pointer mb-1 w-full h-9 px-2"
      >
        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
          <Navigation20Regular className="shrink-0" />
        </div>
      </button>

      <SidebarItem
        icon={<HomeRegular fontSize={20} />}
        label={t("home")}
        active={activeTab === "home"}
        onClick={() => setActiveTab("home")}
        isExpanded={isExpanded}
      />
      <SidebarItem
        icon={<BoardRegular fontSize={20} />}
        label={t("monitors")}
        active={activeTab === "layout"}
        onClick={() => setActiveTab("layout")}
        isExpanded={isExpanded}
      />
      <SidebarItem
        icon={<AppsRegular fontSize={20} />}
        label={t("library")}
        active={activeTab === "widgets_library"}
        onClick={() => setActiveTab("widgets_library")}
        isExpanded={isExpanded}
      />
      <SidebarItem
        icon={<SettingsRegular fontSize={20} />}
        label={t("settings")}
        active={activeTab === "settings"}
        onClick={() => setActiveTab("settings")}
        isExpanded={isExpanded}
      />
      <div className="flex-grow" />
      <SidebarItem
        icon={<PowerRegular fontSize={20} />}
        label={t("shutdown")}
        active={false}
        onClick={handleExitApp}
        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-400 dark:hover:bg-red-500/20"
        title={t("shutdownDesc")}
        isExpanded={isExpanded}
      />
    </div>
  );
}
