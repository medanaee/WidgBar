import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BarWidget } from '../types/layout';
import { useSettingsStore } from '../stores/settingsStore';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { listen } from '@tauri-apps/api/event';
import { useWidgetInstanceStore } from '@/stores/widgetInstanceStore';
import { useWidgetConstraintsStore } from '../stores/widgetConstraintsStore';

interface Props {
    widget: BarWidget;
    children: React.ReactNode;
}

export default function WidgetBarItem({ widget, children }: Props) {
    const settings = useSettingsStore(state => state.settings);
    const animate = settings?.barAnimate !== false;
    const [isHighlighted, setIsHighlighted] = useState(false);

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

    const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        
        // Find default dimensions from registry by widget type
        const registry = useWidgetRegistryStore.getState().registry;
        const config = registry[widget.type];
        
        // Check instance config first, then registry default, then fallback
        const instanceConfig = useWidgetInstanceStore.getState().instances[widget.id];
        let width = instanceConfig?.popupWidth;
        let height = instanceConfig?.popupHeight;
        
        if (!width || !height) {
            if (config) {
                width = width || config.default_width || 300;
                height = height || config.default_height || 300;
            } else {
                width = width || 300;
                height = height || 300;
            }
        }

        try {
            await invoke('request_popup', {
                x: x,
                y: 0,
                width: width,
                height: height,
                route: `/popup/${widget.type}/${widget.id}`,
                closeOnBlur: true,
                xIsCenter: true,
                animated: true,
                belowBar: true,
                center: false
            });
        } catch (error) {
            console.error('Failed to request popup:', error);
        }
    };

    const constraints = useWidgetConstraintsStore(state => state.constraints[widget.id]);
    const barPadding = constraints?.barPadding ?? 1;
    const isHidden = constraints?.hiddenInBar === true;
    
    const paddingClass = {
        0: 'px-0',
        1: 'px-1',
        2: 'px-2',
        3: 'px-3',
        4: 'px-4'
    }[barPadding] ?? 'px-2';

    // Keep children mounted so the widget can keep listening and un-hide itself
    if (isHidden) {
        return <div className="hidden" aria-hidden>{children}</div>;
    }

    return (
        <div 
            onClick={handleClick}
            className={`flex items-center justify-center h-full ${paddingClass} transition-colors rounded-md cursor-pointer select-none ${
                isHighlighted 
                    ? 'bg-primary/20 ring-1 ring-primary/50 shadow-sm'
                    : 'hover:bg-white/10'
            } ${
                animate ? 'transition-all duration-300 ease-in-out animate-in fade-in zoom-in-95' : ''
            }`}
        >
            {children}
        </div>
    );
}
