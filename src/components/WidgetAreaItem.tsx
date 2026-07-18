import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { DesktopWidget } from '../types/layout';
import { listen } from '@tauri-apps/api/event';
import { useWidgetConstraintsStore } from '../stores/widgetConstraintsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSnapStore } from '../stores/snapStore';

const BORDER_RADIUS = 24.0;

interface WidgetProps {
    widget: DesktopWidget;
    index: number;
    allWidgets: DesktopWidget[];
    activeWidgetId: string | null;
    setActiveWidgetId: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<DesktopWidget>, broadcast?: boolean) => void;
    isEditMode?: boolean;
    children: React.ReactNode;
}

export default function WidgetAreaItem({ 
    widget, 
    index, 
    allWidgets,
    activeWidgetId,
    setActiveWidgetId,
    onUpdate, 
    isEditMode,
    children
}: WidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef({ offsetX: 0, offsetY: 0 });
    const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });
    const snapCoordsRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
    const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track local interaction state for styling
    const [action, setAction] = useState<'drag' | 'resize' | null>(null);
    const [isHighlighted, setIsHighlighted] = useState(false);
    const constraints = useWidgetConstraintsStore(state => state.constraints[widget.id]);

    useEffect(() => {
        const unlisten = listen('widget-highlight', (event: any) => {
            const { widgetId, isHighlighted: active } = event.payload;
            if (widgetId === widget.id) {
                setIsHighlighted(active);
            }
        });
        return () => {
            unlisten.then(f => f());
        };
    }, [widget.id]);

    // Automatically adjust size if widget constraints update to define a new aspect ratio
    useEffect(() => {
        if (constraints?.aspectRatio) {
            const ratio = constraints.aspectRatio;
            const currentRatio = widget.width / widget.height;
            if (Math.abs(currentRatio - ratio) > 0.01) {
                let newWidth = widget.width;
                let newHeight = newWidth / ratio;

                const minW = constraints.minW ?? 120;
                const maxW = constraints.maxW ?? Infinity;
                const minH = constraints.minH ?? 120;
                const maxH = constraints.maxH ?? Infinity;

                if (newHeight < minH) {
                    newHeight = minH;
                    newWidth = newHeight * ratio;
                } else if (newHeight > maxH) {
                    newHeight = maxH;
                    newWidth = newHeight * ratio;
                }

                if (newWidth < minW) {
                    newWidth = minW;
                    newHeight = newWidth / ratio;
                } else if (newWidth > maxW) {
                    newWidth = maxW;
                    newHeight = newWidth / ratio;
                }

                onUpdate(widget.id, {
                    width: Math.round(newWidth),
                    height: Math.round(newHeight)
                }, true);
            }
        }
    }, [
        constraints?.aspectRatio,
        constraints?.minW,
        constraints?.maxW,
        constraints?.minH,
        constraints?.maxH,
        widget.id,
        widget.width,
        widget.height,
        onUpdate
    ]);
    
    const settings = useSettingsStore(state => state.settings);
    const setSnapLines = useSnapStore(state => state.setLines);
    const snapMargin = settings?.snapMargin ?? 16;
    const SNAP_THRESHOLD = 12;

    const getTargetLines = (ignoreId: string) => {
        const vLines: number[] = [];
        const hLines: number[] = [];

        if (snapMargin > 0) {
            vLines.push(snapMargin, window.innerWidth / 2, window.innerWidth - snapMargin);
            hLines.push(snapMargin, window.innerHeight / 2, window.innerHeight - snapMargin);
        } else {
            vLines.push(0, window.innerWidth / 2, window.innerWidth);
            hLines.push(0, window.innerHeight / 2, window.innerHeight);
        }

        allWidgets.forEach(w => {
            if (w.id === ignoreId) return;
            vLines.push(w.x - snapMargin, w.x, w.x + w.width / 2, w.x + w.width, w.x + w.width + snapMargin);
            hLines.push(w.y - snapMargin, w.y, w.y + w.height / 2, w.y + w.height, w.y + w.height + snapMargin);
        });

        return { vLines: Array.from(new Set(vLines)), hLines: Array.from(new Set(hLines)) };
    };

    // Filter widgets that are VISUALLY ON TOP of this current widget
    const higherWidgets = allWidgets.filter((w, j) => {
        if (w.id === widget.id) return false; 
        if (w.id === activeWidgetId) return true; // Active widget is always on top
        if (activeWidgetId === widget.id) return false; // If I am active, nobody is above me
        return j > index; // Otherwise, widgets rendered after me are on top
    });

    // We stringify the coordinates to avoid unnecessary re-renders in the useEffect
    const higherWidgetsDeps = JSON.stringify(higherWidgets.map(w => ({ x: w.x, y: w.y, width: w.width, height: w.height })));

    // Apply the internal mask: This punches holes in THIS widget based on widgets ABOVE it
    useEffect(() => {
        if (!containerRef.current) return;

        if (higherWidgets.length === 0) {
            containerRef.current.style.WebkitMaskImage = 'none';
            containerRef.current.style.maskImage = 'none';
            return;
        }

        // Calculate hole coordinates relative to this widget's top-left corner
        const svgMask = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${widget.width}" height="${widget.height}">
                <mask id="inter-widget-hole">
                    <rect width="100%" height="100%" fill="white" />
                    ${higherWidgets.map(w => `
                        <rect 
                            x="${w.x - widget.x}" 
                            y="${w.y - widget.y}" 
                            width="${w.width}" 
                            height="${w.height}" 
                            rx="${BORDER_RADIUS}" 
                            fill="black" 
                        />
                    `).join('')}
                </mask>
                <rect width="100%" height="100%" fill="black" mask="url(#inter-widget-hole)" />
            </svg>
        `;

        const encodedSvg = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMask)}")`;
        containerRef.current.style.WebkitMaskImage = encodedSvg;
        containerRef.current.style.maskImage = encodedSvg;
        containerRef.current.style.WebkitMaskSize = '100% 100%';
        containerRef.current.style.maskSize = '100% 100%';

    }, [widget.x, widget.y, widget.width, widget.height, higherWidgetsDeps]);

    // Clean up region strictly on unmount
    useEffect(() => {
        return () => {
            invoke('remove_region', {
                label: getCurrentWebviewWindow().label,
                widgetId: widget.id
            }).catch(console.error);
        };
    }, [widget.id]);

    // Keep region updated on mount and coordinate changes (only when not actively dragging/resizing)
    useEffect(() => {
        if (action !== null) return; 

        const updateWidgetRegion = async () => {
            try {
                await invoke('request_region', {
                    label: getCurrentWebviewWindow().label,
                    widgetId: widget.id,
                    x: widget.x * window.devicePixelRatio,
                    y: widget.y * window.devicePixelRatio,
                    width: widget.width * window.devicePixelRatio,
                    height: widget.height * window.devicePixelRatio,
                    borderRadius: BORDER_RADIUS * window.devicePixelRatio
                });
            } catch (error) { 
                console.error("[ERROR] request_region:", error); 
            }
        };

        const timerId = setTimeout(updateWidgetRegion, 50);
        return () => clearTimeout(timerId);
    }, [widget.id, widget.x, widget.y, widget.width, widget.height, action]);

    // Drag Handlers
    const handleDragDown = async (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return; 
        e.currentTarget.setPointerCapture(e.pointerId);
        setAction('drag');
        setActiveWidgetId(widget.id); // Broadcast that this widget is on top
        dragRef.current = { offsetX: e.clientX - widget.x, offsetY: e.clientY - widget.y };
        snapCoordsRef.current = { x: widget.x, y: widget.y, w: widget.width, h: widget.height };
        
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        await new Promise<void>((resolve) => {
            delayTimeoutRef.current = setTimeout(() => { resolve(); }, 50);
        });

        await invoke('start_change_region', { label: getCurrentWebviewWindow().label, widgetId: widget.id }).catch(console.error);
    };

    const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (action !== 'drag') return;
        
        let newX = e.clientX - dragRef.current.offsetX;
        let newY = e.clientY - dragRef.current.offsetY;

        if (snapMargin > 0) {
            const { vLines, hLines } = getTargetLines(widget.id);
            const activeEdgesV = [newX, newX + widget.width / 2, newX + widget.width];
            const activeEdgesH = [newY, newY + widget.height / 2, newY + widget.height];
            
            let bestVSnap: { pos: number, dist: number, activeIdx: number } | null = null;
            let bestHSnap: { pos: number, dist: number, activeIdx: number } | null = null;

            vLines.forEach(target => {
                activeEdgesV.forEach((edge, idx) => {
                    const dist = Math.abs(edge - target);
                    if (dist < SNAP_THRESHOLD) {
                        if (!bestVSnap || dist < bestVSnap.dist) bestVSnap = { pos: target, dist, activeIdx: idx };
                    }
                });
            });

            hLines.forEach(target => {
                activeEdgesH.forEach((edge, idx) => {
                    const dist = Math.abs(edge - target);
                    if (dist < SNAP_THRESHOLD) {
                        if (!bestHSnap || dist < bestHSnap.dist) bestHSnap = { pos: target, dist, activeIdx: idx };
                    }
                });
            });

            const newLines: any[] = [];
            if (bestVSnap) {
                if (bestVSnap.activeIdx === 0) newX = bestVSnap.pos;
                else if (bestVSnap.activeIdx === 1) newX = bestVSnap.pos - widget.width / 2;
                else if (bestVSnap.activeIdx === 2) newX = bestVSnap.pos - widget.width;
                newLines.push({ type: 'vertical', position: bestVSnap.pos });
            }
            if (bestHSnap) {
                if (bestHSnap.activeIdx === 0) newY = bestHSnap.pos;
                else if (bestHSnap.activeIdx === 1) newY = bestHSnap.pos - widget.height / 2;
                else if (bestHSnap.activeIdx === 2) newY = bestHSnap.pos - widget.height;
                newLines.push({ type: 'horizontal', position: bestHSnap.pos });
            }

            setSnapLines(newLines);
        }

        snapCoordsRef.current.x = newX;
        snapCoordsRef.current.y = newY;
        onUpdate(widget.id, { x: newX, y: newY }, false);
    };

    const handleDragUp = async (e: React.PointerEvent<HTMLDivElement>) => {
        if (action !== 'drag') return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setAction(null);
        setActiveWidgetId(null);
        setSnapLines([]);

        if (delayTimeoutRef.current) {
            clearTimeout(delayTimeoutRef.current);
            delayTimeoutRef.current = null;
        }

        onUpdate(widget.id, { x: snapCoordsRef.current.x, y: snapCoordsRef.current.y }, true);
        await invoke('stop_change_region', {
            label: getCurrentWebviewWindow().label,
            widgetId: widget.id,
            x: snapCoordsRef.current.x * window.devicePixelRatio,
            y: snapCoordsRef.current.y * window.devicePixelRatio,
            width: widget.width * window.devicePixelRatio,
            height: widget.height * window.devicePixelRatio,
            borderRadius: BORDER_RADIUS * window.devicePixelRatio
        }).catch(console.error);
    };

    // Resize Handlers
    const handleResizeDown = async (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation(); 
        e.currentTarget.setPointerCapture(e.pointerId);
        setAction('resize');
        setActiveWidgetId(widget.id); // Broadcast that this widget is on top
        resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: widget.width, startH: widget.height };
        snapCoordsRef.current = { x: widget.x, y: widget.y, w: widget.width, h: widget.height };
        
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        await new Promise<void>((resolve) => {
            delayTimeoutRef.current = setTimeout(() => { resolve(); }, 150);
        });

        await invoke('start_change_region', { label: getCurrentWebviewWindow().label, widgetId: widget.id }).catch(console.error);
    };

    const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (action !== 'resize') return;
        
        let newWidth = resizeRef.current.startW + (e.clientX - resizeRef.current.startX);
        let newHeight = resizeRef.current.startH + (e.clientY - resizeRef.current.startY);
        
        const minW = constraints?.minW ?? 120;
        const maxW = constraints?.maxW ?? Infinity;
        const minH = constraints?.minH ?? 120;
        const maxH = constraints?.maxH ?? Infinity;
        
        if (constraints?.aspectRatio) {
            const ratio = constraints.aspectRatio;
            const deltaX = Math.abs(e.clientX - resizeRef.current.startX);
            const deltaY = Math.abs(e.clientY - resizeRef.current.startY);
            
            if (deltaX > deltaY) {
                newWidth = Math.max(minW, Math.min(maxW, newWidth));
                newHeight = newWidth / ratio;
                if (newHeight < minH) {
                    newHeight = minH;
                    newWidth = newHeight * ratio;
                } else if (newHeight > maxH) {
                    newHeight = maxH;
                    newWidth = newHeight * ratio;
                }
            } else {
                newHeight = Math.max(minH, Math.min(maxH, newHeight));
                newWidth = newHeight * ratio;
                if (newWidth < minW) {
                    newWidth = minW;
                    newHeight = newWidth / ratio;
                } else if (newWidth > maxW) {
                    newWidth = maxW;
                    newHeight = newWidth / ratio;
                }
            }
        } else {
            newWidth = Math.max(minW, Math.min(maxW, newWidth));
            newHeight = Math.max(minH, Math.min(maxH, newHeight));
        }

        if (snapMargin > 0) {
            const { vLines, hLines } = getTargetLines(widget.id);
            const activeRight = widget.x + newWidth;
            const activeBottom = widget.y + newHeight;
            
            let bestVSnap: { pos: number, dist: number } | null = null;
            let bestHSnap: { pos: number, dist: number } | null = null;

            vLines.forEach(target => {
                const dist = Math.abs(activeRight - target);
                if (dist < SNAP_THRESHOLD) {
                    if (!bestVSnap || dist < bestVSnap.dist) bestVSnap = { pos: target, dist };
                }
            });

            hLines.forEach(target => {
                const dist = Math.abs(activeBottom - target);
                if (dist < SNAP_THRESHOLD) {
                    if (!bestHSnap || dist < bestHSnap.dist) bestHSnap = { pos: target, dist };
                }
            });

            const newLines: any[] = [];
            if (constraints?.aspectRatio) {
                const ratio = constraints.aspectRatio;
                if (bestVSnap && (!bestHSnap || bestVSnap.dist <= bestHSnap.dist)) {
                    newWidth = bestVSnap.pos - widget.x;
                    newWidth = Math.max(minW, Math.min(maxW, newWidth));
                    newHeight = newWidth / ratio;
                    if (newHeight < minH) {
                        newHeight = minH;
                        newWidth = newHeight * ratio;
                    } else if (newHeight > maxH) {
                        newHeight = maxH;
                        newWidth = newHeight * ratio;
                    }
                    newLines.push({ type: 'vertical', position: bestVSnap.pos });
                } else if (bestHSnap) {
                    newHeight = bestHSnap.pos - widget.y;
                    newHeight = Math.max(minH, Math.min(maxH, newHeight));
                    newWidth = newHeight * ratio;
                    if (newWidth < minW) {
                        newWidth = minW;
                        newHeight = newWidth / ratio;
                    } else if (newWidth > maxW) {
                        newWidth = maxW;
                        newHeight = newWidth * ratio;
                    }
                    newLines.push({ type: 'horizontal', position: bestHSnap.pos });
                }
            } else {
                if (bestVSnap) {
                    newWidth = bestVSnap.pos - widget.x;
                    newWidth = Math.max(minW, Math.min(maxW, newWidth));
                    newLines.push({ type: 'vertical', position: bestVSnap.pos });
                }
                if (bestHSnap) {
                    newHeight = bestHSnap.pos - widget.y;
                    newHeight = Math.max(minH, Math.min(maxH, newHeight));
                    newLines.push({ type: 'horizontal', position: bestHSnap.pos });
                }
            }
            
            setSnapLines(newLines);
        }
        
        snapCoordsRef.current.w = newWidth;
        snapCoordsRef.current.h = newHeight;
        onUpdate(widget.id, { width: newWidth, height: newHeight }, false);
    };

    const handleResizeUp = async (e: React.PointerEvent<HTMLDivElement>) => {
        if (action !== 'resize') return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setAction(null);
        setActiveWidgetId(null);
        setSnapLines([]);

        if (delayTimeoutRef.current) {
            clearTimeout(delayTimeoutRef.current);
            delayTimeoutRef.current = null;
        }

        onUpdate(widget.id, { width: snapCoordsRef.current.w, height: snapCoordsRef.current.h }, true);
        await invoke('stop_change_region', {
            label: getCurrentWebviewWindow().label,
            widgetId: widget.id,
            x: widget.x * window.devicePixelRatio,
            y: widget.y * window.devicePixelRatio,
            width: snapCoordsRef.current.w * window.devicePixelRatio,
            height: snapCoordsRef.current.h * window.devicePixelRatio,
            borderRadius: BORDER_RADIUS * window.devicePixelRatio
        }).catch(console.error);
    };

    const isInteracting = action !== null;
    const isDark = settings?.theme === 'dark' || 
        (settings?.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const bgOpacity = (settings?.widgetBgOpacity ?? 80) / 100;
    
    return (
        <div
            ref={containerRef}
            className={`absolute flex items-center justify-center select-none overflow-hidden transition duration-50 ease-out border pointer-events-auto ${isInteracting 
                ? 'border-zinc-500/30 dark:border-white/20 bg-white dark:bg-zinc-800 shadow-xl z-50' 
                : isHighlighted
                    ? 'border-3 border-primary shadow-lg shadow-primary/5 z-[9999] scale-[1.015]'
                    : 'border-zinc-500/10 dark:border-white/10'
            }`}
            style={{
                left: `${widget.x}px`, 
                top: `${widget.y}px`, 
                width: `${widget.width}px`, 
                height: `${widget.height}px`,
                borderRadius: `${BORDER_RADIUS}px`, 
                cornerShape: 'round',
                touchAction: 'none', 
                // Dynamically assign z-index based on global active state
                zIndex: activeWidgetId === widget.id ? 9999 : index + 10,
                backgroundColor: isInteracting 
                    ? undefined 
                    : isDark 
                        ? `rgba(24, 24, 27, ${bgOpacity})` 
                        : `rgba(255, 255, 255, ${bgOpacity})`
            }}
        >
            <div className="w-full h-full pointer-events-auto">
                {children}
            </div>
            
            {/* Inner Highlight Double Border Overlay */}
            {isHighlighted && (
                <div 
                    className="absolute inset-[3px] border border-primary pointer-events-none z-[9998]"
                    style={{ borderRadius: `${BORDER_RADIUS - 3}px` }}
                />
            )}
            
            {/* Edit Mode Handles */}
            {isEditMode && (
                <>
                    {/* Move Handle (Bottom Center) */}
                    <div
                        onPointerDown={handleDragDown}
                        onPointerMove={handleDragMove}
                        onPointerUp={handleDragUp}
                        onPointerCancel={handleDragUp}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-zinc-900/40 dark:bg-white/80 hover:bg-zinc-900/80 dark:hover:bg-white cursor-grab active:cursor-grabbing shadow-sm transition-all pointer-events-auto flex items-center justify-center"
                    />

                    {/* Resize Handle (Bottom Right) */}
                    <div
                        onPointerDown={handleResizeDown}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeUp}
                        onPointerCancel={handleResizeUp}
                        className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-2 opacity-80 hover:opacity-100 transition-opacity pointer-events-auto"
                    >
                        {/* A beautiful minimal corner grip */}
                        <div className="w-3.5 h-3.5 border-r-2 border-b-2 border-zinc-500 dark:border-white rounded-br-2xl pointer-events-none" />
                    </div>
                </>
            )}
        </div>
    );
}