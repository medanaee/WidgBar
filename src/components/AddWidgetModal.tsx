import React from 'react';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { LayoutGrid } from 'lucide-react';
import { CutoutModal } from './ui/CutoutModal';
import { useTranslation, TranslationKey } from '../lib/i18n';
import { FluentIconMap } from '../lib/widgetIcons';

interface AddWidgetModalProps {
  context: "bar" | "widgetArea";
  isOpen: boolean;
  onClose: () => void;
  onSelect: (typeName: string) => void;
}

export function AddWidgetModal({ isOpen, onClose, onSelect, context }: AddWidgetModalProps) {
  const { registry } = useWidgetRegistryStore();
  const { t } = useTranslation();

  if (!isOpen) return null;

  const widgets = Object.values(registry).filter(w => 
    context === "bar" ? w.can_be_in_bar : w.can_be_in_area
  );

  return (
    <CutoutModal 
      isOpen={isOpen} 
      onClose={onClose} 
      contentClassName="w-[300px] bg-zinc-100/30 dark:bg-zinc-900/30 border border-zinc-500/20 rounded-xl shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-500/20 bg-zinc-50/20 dark:bg-zinc-900/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {context === 'bar' ? t("addBarWidget" as TranslationKey) : t("addDesktopWidget" as TranslationKey)}
          </h3>
        </div>
        
        <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto">
          {widgets.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">{t("noWidgets" as TranslationKey)}</div>
          ) : (
            widgets.map(w => {
              const IconComponent = FluentIconMap[w.icon] || LayoutGrid;
              return (
                <button
                  key={w.type_name}
                  onClick={() => {
                    onSelect(w.type_name);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-zinc-500/20 dark:hover:bg-zinc-500/20 transition-colors text-left"
                >
                  <div className="shrink-0 flex items-center justify-center">
                    <IconComponent className="w-8 h-8 text-zinc-700 dark:text-zinc-200" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 capitalize">
                      {t(w.nameKey as TranslationKey)}
                    </span>
                    {w.descriptionKey && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                        {t(w.descriptionKey as TranslationKey)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
    </CutoutModal>
  );
}
