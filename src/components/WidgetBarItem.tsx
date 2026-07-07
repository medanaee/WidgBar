import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BarWidget } from '../types/layout';
import { useSettingsStore } from '../stores/settingsStore';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';

interface Props {
    widget: BarWidget;
    children: React.ReactNode;
}

export default function WidgetBarItem({ widget, children }: Props) {
    const settings = useSettingsStore(state => state.settings);
    const animate = settings?.barAnimate !== false;

    const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        
        // Find default dimensions from registry by widget type
        const registry = useWidgetRegistryStore.getState().registry;
        const config = registry[widget.type];
        let width = 300;
        let height = 300;
        
        if (config) {
            width = config.default_width || width;
            height = config.default_height || height;
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

    return (
        <div 
            onClick={handleClick}
            className={`flex items-center justify-center h-full px-2 hover:bg-white/10 transition-colors rounded-md cursor-pointer select-none ${
                animate ? 'transition-all duration-300 ease-in-out animate-in fade-in zoom-in-95' : ''
            }`}
        >
            {children}
        </div>
    );
}
