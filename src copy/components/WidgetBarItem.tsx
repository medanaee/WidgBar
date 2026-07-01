import React from 'react';
import { BarWidget } from '../types/layout';

interface Props {
    widget: BarWidget;
    children: React.ReactNode;
}

export default function WidgetBarItem({ widget, children }: Props) {
    return (
        <div className="flex items-center justify-center h-full px-2 hover:bg-white/10 transition-colors rounded-md cursor-pointer select-none">
            {children}
        </div>
    );
}
