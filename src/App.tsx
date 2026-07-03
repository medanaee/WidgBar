import { useState, useEffect, useRef } from "react";
import "./App.css"
import { invoke } from "@tauri-apps/api/core";
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import Main from "./components/Main";
import WidgetsArea from "./components/WidgetsArea";
import Bar from "./components/Bar";
import { useLayoutStore } from "./stores/layoutStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useWidgetRegistryStore } from "./stores/widgetRegistryStore";
import { useWidgetInstanceStore } from "./stores/widgetInstanceStore";

interface BackendMonitorInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  is_primary: boolean;
  scale_factor: number;
}

interface BackendLayoutState {
  monitors: Record<string, BackendMonitorInfo>;
}

function AppContent() {
    const navigate = useNavigate();
    const location = useLocation();

    const fetchAndSyncLayouts = useLayoutStore((state) => state.fetchAndSyncLayouts);
    const fetchAndSyncSettings = useSettingsStore((state) => state.fetchAndSyncSettings);
    const settings = useSettingsStore((state) => state.settings);
    const initRan = useRef(false);

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

    useEffect(() => {
        useSettingsStore.getState().fetchAndSyncSettings();
        useLayoutStore.getState().fetchAndSyncLayouts();
        useWidgetInstanceStore.getState().fetchInstances();
        useWidgetRegistryStore.getState().fetchRegistry().then(() => {
            useWidgetRegistryStore.getState().registerWidgetType({
                type_name: 'clock',
                icon: 'ClockColor',
                description: 'A simple minimalist digital clock with date.',
                can_be_in_bar: true,
                can_be_in_area: true,
                default_config: {},
                default_width: 300,
                default_height: 150
            });
            useWidgetRegistryStore.getState().registerWidgetType({
                type_name: 'todo',
                icon: 'ClipboardTaskColor',
                description: 'A simple minimalist to-do list for testing.',
                can_be_in_bar: true,
                can_be_in_area: true,
                default_config: {},
                default_width: 250,
                default_height: 300
            });
            useWidgetRegistryStore.getState().registerWidgetType({
                type_name: 'calendar',
                icon: 'CalendarColor',
                description: 'A simple calendar grid for testing.',
                can_be_in_bar: true,
                can_be_in_area: true,
                default_config: {},
                default_width: 280,
                default_height: 250
            });
            useWidgetRegistryStore.getState().registerWidgetType({
                type_name: 'timer',
                icon: 'ClockAlarmColor',
                description: 'A simple timer for testing.',
                can_be_in_bar: true,
                can_be_in_area: true,
                default_config: {},
                default_width: 200,
                default_height: 150
            });
        });
    }, []);

    useEffect(() => {
        const init = async () => {
            if (initRan.current || location.pathname !== '/') return;
            initRan.current = true;
            
            await fetchAndSyncSettings();
            await fetchAndSyncLayouts();
            
            try {
                const backendState = await invoke<BackendLayoutState>('get_layout');
                console.log(backendState);
                const state = useLayoutStore.getState();
                const currentLayoutName = state.currentLayout;
                let currentData = state.layouts[currentLayoutName];
                
                if (!currentData) {
                    currentData = { monitors: [] };
                }

                let changed = false;
                const updatedMonitors = [...currentData.monitors];

                for (let i = 0; i < updatedMonitors.length; i++) {
                    const m = updatedMonitors[i];
                    const isStillConnected = Object.values(backendState.monitors).some(bm => bm.id === m.id);
                    if (!isStillConnected) {
                        if (!m.is_disconnected) {
                            updatedMonitors[i] = { ...m, is_disconnected: true };
                            changed = true;
                        }
                    } else {
                        if (m.is_disconnected) {
                            updatedMonitors[i] = { ...m, is_disconnected: false };
                            changed = true;
                        }
                    }
                }

                for (const [, backendMon] of Object.entries(backendState.monitors)) {
                    const existingIdx = updatedMonitors.findIndex(m => m.id === backendMon.id);
                    if (existingIdx === -1) {
                        updatedMonitors.push({
                            id: backendMon.id,
                            name: backendMon.name,
                            width: backendMon.width,
                            height: backendMon.height,
                            x: backendMon.x,
                            y: backendMon.y,
                            is_primary: backendMon.is_primary,
                            scale_factor: backendMon.scale_factor,
                            has_bar: backendMon.is_primary,
                            has_widget_area: false,
                            bar: backendMon.is_primary ? [{ id: `bar_widget_${Date.now()}` }] : [],
                            widgetArea: [],
                            is_disconnected: false
                        });
                        changed = true;
                    } else {
                        let currentMonitor = updatedMonitors[existingIdx];
                        let updated = false;

                        if (
                            currentMonitor.width !== backendMon.width ||
                            currentMonitor.height !== backendMon.height ||
                            currentMonitor.x !== backendMon.x ||
                            currentMonitor.y !== backendMon.y ||
                            currentMonitor.scale_factor !== backendMon.scale_factor
                        ) {
                            currentMonitor = {
                                ...currentMonitor,
                                width: backendMon.width,
                                height: backendMon.height,
                                x: backendMon.x,
                                y: backendMon.y,
                                scale_factor: backendMon.scale_factor
                            };
                            updated = true;
                        }

                        if (currentMonitor.is_primary !== backendMon.is_primary) {
                            currentMonitor = { ...currentMonitor, is_primary: backendMon.is_primary };
                            
                            // If monitor is demoted from primary to secondary, remove its auto-assigned bar
                            if (!backendMon.is_primary && currentMonitor.has_bar) {
                                currentMonitor.has_bar = false;
                                currentMonitor.bar = [];
                            }
                            
                            updated = true;
                        }

                        // Ensure primary monitor always has a bar
                        if (currentMonitor.is_primary && !currentMonitor.has_bar) {
                            currentMonitor = { 
                                ...currentMonitor, 
                                has_bar: true, 
                                bar: [{ id: `bar_widget_${Date.now()}` }] 
                            };
                            updated = true;
                        }

                        if (updated) {
                            updatedMonitors[existingIdx] = currentMonitor;
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    useLayoutStore.getState().setLayouts({
                        ...state.layouts,
                        [currentLayoutName]: { ...currentData, monitors: updatedMonitors }
                    });
                }

                // Create physical windows based on store for connected monitors
                const finalMonitors = useLayoutStore.getState().layouts[currentLayoutName].monitors;
                const barHeight = useSettingsStore.getState().settings.barHeight;
                for (const m of finalMonitors) {
                    if (m.is_disconnected) continue;
                    
                    if (m.has_bar) {
                        await invoke('create_bar', { monitorId: m.id, height: barHeight }).catch(console.error);
                    }
                    if (m.has_widget_area) {
                        await invoke('create_widget_area', { monitorId: m.id }).catch(console.error);
                    }
                }

            } catch (err) {
                console.error("Failed to initialize monitors:", err);
            }
        };

        init();
    }, [fetchAndSyncLayouts, fetchAndSyncSettings, location.pathname]);

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
                            const appWindow = getCurrentWebviewWindow();
                            await appWindow.emit('show_ready');
                            console.log("DOM settled and notified Rust for:", location.pathname);
                        } catch (error) {
                            console.error("Failed to emit show_ready:", error);
                        }
                    }, 50);
                });
            };

            notifyRust();
        };

        const appWindow = getCurrentWebviewWindow();

        const unlisten = appWindow.listen('rust-navigation', handleRustNav);

        return () => {
            unlisten.then(f => f());
        };
    }, [navigate, location.pathname]);

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
        <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/bar/:monitorId" element={<Bar />} />
            <Route path="/widget_area/:monitorId" element={<WidgetsArea />} />
        </Routes>
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