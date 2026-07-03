import React, { Suspense } from 'react';
import { useTranslation } from '../lib/i18n';

interface Props {
    widgetType: string;
}

export default function GlobalWidgetSettingsPanel({ widgetType }: Props) {
    const { t } = useTranslation();

    const TypeSettingComponent = React.lazy(() => import(`../widgets/${widgetType}/typeSetting.tsx`).catch(() => {
        return { 
            default: () => (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-500/30 rounded-xl mt-4 bg-zinc-500/5">
                    <span className="text-sm text-zinc-500 font-medium">No global settings available for this widget type.</span>
                </div>
            ) 
        };
    }));

    return (
        <div className="max-w-xl w-full self-center h-full animate-in fade-in zoom-in-95 duration-200 overflow-y-auto custom-scrollbar ltr:pr-2 ltr:-mr-2 rtl:pl-2 rtl:-ml-2">
            <h2 className="text-xl font-semibold mb-2 capitalize text-zinc-800 dark:text-zinc-100">{widgetType} Settings</h2>
            <p className="text-xs text-zinc-500 mb-6">Configure global preferences for all {widgetType} widgets</p>
            <Suspense fallback={<div className="text-zinc-500 text-sm mt-4">Loading settings...</div>}>
                <TypeSettingComponent />
            </Suspense>
        </div>
    );
}
