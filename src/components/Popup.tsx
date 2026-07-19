import React, { useMemo, Suspense } from 'react';
import { useParams } from 'react-router-dom';

export default function Popup() {
    const { widgetType, widgetId } = useParams<{ widgetType: string; widgetId: string }>();

    const InnerComponent = useMemo(() => {
        if (!widgetType) return null;
        return React.lazy(() => import(`../widgets/${widgetType}/Area.tsx`).catch(() => {
            return { default: () => <div className="text-red-500 text-xs p-4">Error loading {widgetType}</div> };
        }));
    }, [widgetType]);

    if (!widgetType || !widgetId) {
        return <div className="w-full h-full flex items-center justify-center text-white">Invalid Parameters</div>;
    }

    return (
        <div
            key={`${widgetType}_${widgetId}`}
            className="fixed inset-0 flex flex-col overflow-hidden bg-transparent"
        >
            <Suspense
                fallback={
                    <div className="flex-1 flex items-center justify-center text-white/50 animate-pulse">
                        Loading...
                    </div>
                }
            >
                {InnerComponent && (
                    <div className="flex-1 min-h-0 w-full flex flex-col">
                        <InnerComponent widgetId={widgetId} />
                    </div>
                )}
            </Suspense>
        </div>
    );
}
