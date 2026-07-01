import React, { Suspense } from 'react';
import { DesktopWidget } from '../types/layout';
import { ArrowLeft } from 'lucide-react';

interface Props {
  widget: DesktopWidget;
  onBack: () => void;
}

export default function WidgetSettingsPanel({ widget, onBack }: Props) {

  // Dynamically load the settings component for this specific widget type
  const SettingComponent = React.lazy(() => import(`../widgets/${widget.type}/setting.tsx`).catch(() => {
    return { 
        default: () => (
            <div className="flex items-center justify-center h-48 border border-dashed border-zinc-500/30 rounded-xl mt-4">
                <span className="text-sm text-zinc-500">No specific settings for this widget.</span>
            </div>
        ) 
    };
  }));

  return (
    <div className="w-full flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 capitalize">
            {widget.type} Settings
          </h2>
          <p className="text-xs text-zinc-500">Configure settings for this specific widget instance</p>
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <Suspense fallback={<div className="text-zinc-500 text-sm mt-4">Loading settings...</div>}>
          <SettingComponent widgetId={widget.id} />
        </Suspense>
      </div>
    </div>
  );
}
