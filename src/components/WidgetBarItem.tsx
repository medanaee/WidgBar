import React from 'react';
import { BarWidget } from '../types/layout';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
    widget: BarWidget;
    children: React.ReactNode;
}

export default function WidgetBarItem({ widget, children }: Props) {
    const settings = useSettingsStore(state => state.settings);
    const animate = settings?.barAnimate !== false;

    return (
        <div className={`flex items-center justify-center h-full px-2 hover:bg-white/10 transition-colors rounded-md cursor-pointer select-none ${
            animate ? 'transition-all duration-300 ease-in-out animate-in fade-in zoom-in-95' : ''
        }`}>
            {children}
        </div>
    );
}
