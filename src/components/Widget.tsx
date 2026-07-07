import React, { lazy, Suspense, useMemo } from 'react';
import WidgetAreaItem from './WidgetAreaItem';
import WidgetBarItem from './WidgetBarItem';
import { DesktopWidget, BarWidget } from '../types/layout';

interface Props {
    context: 'Bar' | 'Area';
    widget: DesktopWidget | BarWidget;
    index: number;
    allWidgets?: DesktopWidget[];
    activeWidgetId?: string | null;
    setActiveWidgetId?: (id: string | null) => void;
    isEditMode?: boolean;
    onUpdate?: (id: string, updates: Partial<DesktopWidget>, broadcast?: boolean) => void;
    onDragEnd?: (id: string) => void;
}

export default function Widget(props: Props) {
    const { context, widget } = props;
    const type = (widget as any).type || 'unknown';

    // Vite can statically analyze this dynamic import because it knows the directory and extension
    const InnerComponent = useMemo(() => {
        return lazy(() => import(`../widgets/${type}/${context}.tsx`).catch(() => {
            return { default: () => <div className="text-red-500 text-xs">Error loading {type}</div> };
        }));
    }, [type, context]);

    if (context === 'Area') {
        const areaProps = props as any;
        return (
            <WidgetAreaItem {...areaProps}>
                <Suspense fallback={<div className="flex w-full h-full items-center justify-center text-white/50 animate-pulse">...</div>}>
                    <InnerComponent widgetId={widget.id} />
                </Suspense>
            </WidgetAreaItem>
        );
    } else {
        return (
            <WidgetBarItem widget={widget as BarWidget}>
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white/50 animate-pulse">...</div>}>
                    <InnerComponent widgetId={widget.id} />
                </Suspense>
            </WidgetBarItem>
        );
    }
}
