import { create } from 'zustand';

export type MainTab = "home" | "settings" | "layout" | "appearance" | "widgets_library" | "ai_services";
export type SettingsSubTab = "general" | "bar" | "widgets";

interface UIState {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  settingsTab: SettingsSubTab;
  setSettingsTab: (tab: SettingsSubTab) => void;
  selectedMonitorId: string | null;
  setSelectedMonitorId: (id: string | null) => void;
  selectedWidgetType: string | null;
  setSelectedWidgetType: (type: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "layout",
  setActiveTab: (activeTab) => set({ activeTab }),

  settingsTab: "general",
  setSettingsTab: (settingsTab) => set({ settingsTab }),

  selectedMonitorId: null,
  setSelectedMonitorId: (selectedMonitorId) => set({ selectedMonitorId }),

  selectedWidgetType: null,
  setSelectedWidgetType: (selectedWidgetType) => set({ selectedWidgetType }),
}));
