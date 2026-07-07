import React from 'react';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { LayoutGrid } from 'lucide-react';
import { ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor } from '@fluentui/react-icons';
import { ArrowLeft } from 'lucide-react';
import { useTranslation, TranslationKey } from '../lib/i18n';
import { Squircle } from './ui/Squircle';

const FluentIconMap: Record<string, React.ComponentType<any>> = {
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor,
};

interface AddWidgetPanelProps {
  context: "bar" | "widgetArea";
  onBack: () => void;
  onSelect: (typeName: string) => void;
}

export default function AddWidgetPanel({ context, onBack, onSelect }: AddWidgetPanelProps) {
  const { registry } = useWidgetRegistryStore();
  const { t } = useTranslation();

  const widgets = Object.values(registry).filter(w => 
    context === "bar" ? w.can_be_in_bar : w.can_be_in_area
  );

  const titleText = context === 'bar' ? t("addBarWidget" as TranslationKey) : t("addDesktopWidget" as TranslationKey);
  const descText = t("selectWidgetDesc" as TranslationKey);

  return (
    <div className="w-full flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-500/10 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            {titleText}
          </h2>
          <p className="text-xs text-zinc-500">{descText}</p>
        </div>
      </div>

      {/* Grid Content of Squircles */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
        {widgets.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {t("noWidgets" as TranslationKey)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {widgets.map(w => {
              const IconComponent = FluentIconMap[w.icon] || LayoutGrid;
              
              // Map widget type to localization key
              let widgetNameKey: TranslationKey = "widgets";
              if (w.type_name === 'clock') widgetNameKey = "widgetClock" as TranslationKey;
              else if (w.type_name === 'todo') widgetNameKey = "widgetTodo" as TranslationKey;
              else if (w.type_name === 'calendar') widgetNameKey = "widgetCalendar" as TranslationKey;
              else if (w.type_name === 'timer') widgetNameKey = "widgetTimer" as TranslationKey;

              return (
                <button
                  key={w.type_name}
                  onClick={() => onSelect(w.type_name)}
                  className="group relative flex flex-col items-center justify-center p-4 text-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                >
                  <Squircle 
                    cornerRadius={20} 
                    cornerSmoothing={0.7}
                    borderWidth={1}
                    borderClassName="stroke-zinc-500/20 group-hover:stroke-primary/40 dark:group-hover:stroke-primary/50 transition-colors"
                    className="absolute inset-0 bg-white/40 dark:bg-zinc-900/10 hover:bg-white/80 dark:hover:bg-zinc-900/50 shadow-sm transition-all group-hover:scale-[1.02] group-active:scale-[0.98]"
                  >
                    <div />
                  </Squircle>
                  
                  {/* Content on top of background squircle */}
                  <div className="relative z-10 flex flex-col items-center gap-2.5">
                    <div className="shrink-0 flex items-center justify-center p-2 bg-zinc-500/5 dark:bg-zinc-500/10 rounded-xl group-hover:bg-primary/10 transition-colors">
                      <IconComponent className="w-9 h-9 text-zinc-700 dark:text-zinc-200 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 capitalize">
                        {t(widgetNameKey)}
                      </span>
                      {w.description && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-[120px] line-clamp-2 leading-tight">
                          {w.description}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
