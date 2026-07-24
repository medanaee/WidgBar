import React, { Suspense } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { LayoutGrid } from 'lucide-react';

export default function WidgetLibraryPanel() {
    const { selectedWidgetType } = useUIStore();

    if (!selectedWidgetType) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <LayoutGrid className="w-16 h-16 opacity-30" />
                <h2 className="text-lg font-medium">Select a widget type from the sidebar</h2>
            </div>
        );
    }

    const TypeSettingComponent = React.lazy(() => import(`../../widgets/${selectedWidgetType}/typeSetting.tsx`).catch(() => {
        return { 
            default: () => (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-500/30 rounded-xl mt-4 bg-zinc-500/5">
                    <span className="text-sm text-zinc-500 font-medium">No global settings available for this widget type.</span>
                </div>
            ) 
        };
    }));

    return (
        <div className="max-w-xl w-full self-center h-full animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
            <h2 className="text-xl font-semibold mb-2 capitalize text-zinc-800 dark:text-zinc-100">{selectedWidgetType} Settings</h2>
            <p className="text-xs text-zinc-500 mb-6">Configure global preferences for all {selectedWidgetType} widgets</p>
            <Suspense fallback={<div className="text-zinc-500 text-sm mt-4">Loading settings...</div>}>
                <TypeSettingComponent />
            </Suspense>
        </div>
    );
}
