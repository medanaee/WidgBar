import { useParams } from 'react-router-dom';
import { useLayoutStore } from '../stores/layoutStore';
import Widget from './Widget';
import { useState, useEffect } from 'react';
import { AddWidgetModal } from "./AddWidgetModal";
import { useSnapStore } from "../stores/snapStore";

export default function WidgetsArea() {
    const { monitorId } = useParams<{ monitorId: string }>();
    const { layouts, currentLayout, updateWidget } = useLayoutStore();
    const monitor = layouts[currentLayout]?.monitors.find(m => m.id === monitorId);
    const widgetsForThisWindow = monitor?.widgetArea || [];

    // Global state to track which widget is currently on top (being interacted with)
    const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const snapLines = useSnapStore(state => state.lines);

    // Make the html background transparent for this window
    useEffect(() => {
        document.documentElement.style.backgroundColor = 'transparent';
        return () => { document.documentElement.style.backgroundColor = ''; };
    }, []);

    const handleDragEnd = async (id: string) => {
        const widget = widgetsForThisWindow.find(w => w.id === id);
        if (!widget) return;
        
        import('@tauri-apps/api/core').then(async ({ invoke }) => {
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            await invoke('stop_change_region', {
                label: getCurrentWebviewWindow().label,
                widgetId: widget.id,
                x: widget.x * window.devicePixelRatio,
                y: widget.y * window.devicePixelRatio,
                width: widget.width * window.devicePixelRatio,
                height: widget.height * window.devicePixelRatio,
                borderRadius: 24.0 * window.devicePixelRatio
            }).catch(console.error);
        });
    };

    return (
        <div className="w-screen h-screen overflow-hidden relative pointer-events-none">
            {/* 1. Global Hole Puncher: Punches holes through the dark overlay for ALL widgets */}
            <svg className="absolute w-0 h-0 pointer-events-none">
                <defs>
                    <mask id="desktop-holes">
                        <rect width="100%" height="100%" fill="white" />
                        {widgetsForThisWindow.map(w => (
                            <rect key={`mask-${w.id}`} x={w.x} y={w.y} width={w.width} height={w.height} rx={24} fill="black" />
                        ))}
                    </mask>
                </defs>
            </svg>

            {/* Background Overlay */}
            <div 
                className="absolute inset-0 bg-white/20 dark:bg-black/40 transition-colors duration-200 pointer-events-none" 
                style={{ maskImage: 'url(#desktop-holes)', WebkitMaskImage: 'url(#desktop-holes)' }}
            />

            {widgetsForThisWindow.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    No Widgets
                </div>
            )}

            {/* Snap Lines Overlay */}
            {snapLines.map((line, idx) => (
                line.type === 'vertical' ? (
                    <div key={`v-${idx}`} className="absolute top-0 bottom-0 w-[1px] bg-red-500/80 z-[10000]" style={{ left: `${line.position}px` }} />
                ) : (
                    <div key={`h-${idx}`} className="absolute left-0 right-0 h-[1px] bg-red-500/80 z-[10000]" style={{ top: `${line.position}px` }} />
                )
            ))}

            {/* 2. Render Widgets: Pass the necessary context so they can mask themselves */}
            {widgetsForThisWindow.map((widget, index) => (
                <Widget
                    key={widget.id}
                    context="area"
                    index={index}
                    widget={widget}
                    allWidgets={widgetsForThisWindow}
                    activeWidgetId={activeWidgetId}
                    setActiveWidgetId={setActiveWidgetId}
                    isEditMode={monitor?.isEditMode || false}
                    onUpdate={(id, updates, broadcast) => updateWidget(monitorId!, id, updates, broadcast)}
                    onDragEnd={handleDragEnd}
                />
            ))}
        </div>
    );
}