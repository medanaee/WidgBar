import React from 'react';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { LayoutGrid } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation, TranslationKey } from '../lib/i18n';
import { FluentIconMap } from '../lib/widgetIcons';

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

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
        {widgets.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {t("noWidgets" as TranslationKey)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {widgets.map(w => {
              const IconComponent = FluentIconMap[w.icon] || LayoutGrid;

              return (
                <button
                  key={w.type_name}
                  onClick={() => onSelect(w.type_name)}
                  className="flex flex-row items-center gap-3.5 p-3.5 w-full rounded-2xl cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary text-left border border-zinc-500/20 transition-colors
                  bg-zinc-500/10 dark:bg-zinc-500/10 hover:bg-zinc-500/20 dark:hover:bg-zinc-500/20"
                >
                  <div className="relative z-10 shrink-0 flex items-center justify-center">
                    <IconComponent className="w-8 h-8 text-zinc-700 dark:text-zinc-200 group-hover:text-primary transition-colors" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col min-w-0 text-left">
                    <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 capitalize truncate">
                      {t(w.nameKey as TranslationKey)}
                    </span>
                    {w.descriptionKey && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-tight">
                        {t(w.descriptionKey as TranslationKey)}
                      </span>
                    )}
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
