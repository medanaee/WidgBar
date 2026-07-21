import { useEffect, lazy, Suspense } from "react";
import "./App.css"
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const Main = lazy(() => import("./components/Main"));
const WidgetsArea = lazy(() => import("./components/WidgetsArea"));
const Bar = lazy(() => import("./components/Bar"));
const Popup = lazy(() => import("./components/Popup"));
const Tooltip = lazy(() => import("./components/Tooltip"));
import { useLayoutStore } from "./stores/layoutStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useWidgetRegistryStore } from "./stores/widgetRegistryStore";
import { useWidgetInstanceStore } from "./stores/widgetInstanceStore";
import { useAiServicesStore } from "./stores/aiServicesStore";
import { useClipboardStore } from "./stores/clipboardStore";
import AiChatRoute from "./components/AiChatRoute";

function AppContent() {
    const navigate = useNavigate();
    const location = useLocation();

    const settings = useSettingsStore((state) => state.settings);

    useEffect(() => {
        if (!settings) return;
        const isDark =
            settings.theme === "dark" ||
            (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

        if (isDark) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }

        document.documentElement.dir = settings.language === 'fa' ? 'rtl' : 'ltr';
    }, [settings?.theme, settings?.language]);

    // Every window (main / bar / area / popup) hydrates its stores from the
    // backend. Monitor reconciliation + window creation + watcher startup now
    // live entirely in Rust, so the frontend only needs to read state.
    useEffect(() => {
        useSettingsStore.getState().fetchAndSyncSettings();
        useLayoutStore.getState().fetchAndSyncLayouts();
        useWidgetInstanceStore.getState().fetchInstances();
        useWidgetRegistryStore.getState().fetchRegistry();
        useAiServicesStore.getState().fetchAndSyncData();
        useClipboardStore.getState().fetchHistory();
    }, []);

    useEffect(() => {
        const handleRustNav = (event: any) => {
            const targetRoute = event.payload?.route || event.detail?.route;
            console.log("Navigating to target route:", targetRoute);

            if (targetRoute) {
                navigate(targetRoute);
            }

            const notifyRust = () => {
                requestAnimationFrame(() => {
                    setTimeout(async () => {
                        try {
                            console.log("DOM settled, notifying Rust forttt:", targetRoute);
                            const appWindow = getCurrentWebviewWindow();
                            await appWindow.emit('show_ready');
                            console.log("DOM settled and notified Rust forrr:", targetRoute);
                        } catch (error) {
                            console.error("Failed to emit show_ready:", error);
                        }
                    }, 50);
                });
            };

            notifyRust();
        };

        window.addEventListener('rust-navigation', handleRustNav);
        return () => window.removeEventListener('rust-navigation', handleRustNav);

    }, []);

    useEffect(() => {
        const notifyRust = async () => {
            try {
                const appWindow = getCurrentWebviewWindow();
                await appWindow.emit('show_ready');
                console.log("DOM settled and notified Rust for:", location.pathname);
            } catch (error) {
                console.error("Failed to emit show_ready:", error);
            }
        };

        notifyRust();
    }, []);


    return (
        <Suspense fallback={<div className="w-full h-screen bg-transparent" />}>
            <Routes>
                <Route path="/" element={<Main />} />
                <Route path="/bar/:monitorId" element={<Bar />} />
                <Route path="/widget_area/:monitorId" element={<WidgetsArea />} />
                <Route path="/popup/:widgetType/:widgetId" element={<Popup />} />
                <Route path="/tooltip/:text" element={<Tooltip />} />
                <Route path="/ai-chat/:instanceId" element={<AiChatRoute />} />
                <Route path="/blank" element={<div />} />
            </Routes>
        </Suspense>
    );
}

function App() {
    return (
        <HashRouter>
            <AppContent />
        </HashRouter>
    );
}


export default App;