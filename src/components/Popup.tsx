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
        <div key={`${widgetType}_${widgetId}`} className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
             <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white/50 animate-pulse">Loading...</div>}>
                 {InnerComponent && <InnerComponent widgetId={widgetId} />}
             </Suspense>
        </div>
    );
}
