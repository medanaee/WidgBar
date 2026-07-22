import { Titlebar } from "./Titlebar";
import { useTranslation } from "../lib/i18n";
import PrimarySidebar from "./PrimarySidebar";
import SecondarySidebar from "./SecondarySidebar";
import WidgetLibraryPanel from "./panels/WidgetLibraryPanel";
import HomePanel from "./panels/HomePanel";
import { CutoutProvider } from "./ui/CutoutProvider";
import LayoutSettingsPanel from "./panels/LayoutSettingsPanel";
import AiServicesPanel from "./panels/aiSevices/AiServicesPanel";
import SettingsPanel from "./panels/SettingsPanel";
import { useUIStore } from "../stores/uiStore";

export default function Main() {
  const { activeTab } = useUIStore();
  const { language } = useTranslation();

  return (
    <CutoutProvider>
      <div className="h-screen flex flex-col bg-transparent text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden select-none" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <Titlebar />

        <div className="flex flex-1 overflow-hidden">
          <PrimarySidebar />
          <SecondarySidebar />

          {/* Content Area */}
          <div className="flex-1 bg-zinc-100/20 dark:bg-zinc-900/20 p-6 z-0 flex flex-col min-h-0 overflow-hidden">
            {activeTab === "home" && <HomePanel />}
            {activeTab === "widgets_library" && <WidgetLibraryPanel />}
            {activeTab === "settings" && <SettingsPanel />}
            {activeTab === "layout" && <LayoutSettingsPanel />}
            {activeTab === "ai_services" && <AiServicesPanel />}
          </div>
        </div>
      </div>
    </CutoutProvider>
  );
}