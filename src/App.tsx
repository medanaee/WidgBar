import { useEffect, lazy, Suspense } from "react";
import "./App.css"
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { hydrateFrontendStores } from "./lib/frontendHydration";

const Main = lazy(() => import("./components/Main"));
const Desktop = lazy(() => import("./components/desktop/Desktop"));
const Bar = lazy(() => import("./components/bar/Bar"));
const Popup = lazy(() => import("./components/Popup"));
const Tooltip = lazy(() => import("./components/ui/Tooltip"));
import { useSettingsStore } from "./stores/settingsStore";
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
        hydrateFrontendStores().catch((error) => {
            console.error("Failed to hydrate frontend stores:", error);
        });
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
                <Route path="/widget_area/:monitorId" element={<Desktop />} />
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