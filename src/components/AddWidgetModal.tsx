import React from 'react';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';
import { LayoutGrid, CheckSquare, Calendar, Timer } from 'lucide-react';
import { ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor } from '@fluentui/react-icons';
import { CutoutModal } from './ui/CutoutModal';

const FluentIconMap: Record<string, React.ComponentType<any>> = {
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor,
};

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (typeName: string) => void;
  context: "bar" | "widgetArea";
}

export function AddWidgetModal({ isOpen, onClose, onSelect, context }: AddWidgetModalProps) {
  const { registry } = useWidgetRegistryStore();

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
            {context === 'bar' ? 'Add Bar Widget' : 'Add Desktop Widget'}
          </h3>
        </div>
        
        <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto">
          {widgets.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">No widgets available</div>
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
                  className="flex items-start gap-3 w-full p-2.5 rounded-lg hover:bg-zinc-500/20 dark:hover:bg-zinc-500/20 transition-colors text-left"
                >
                  <div className="p-1.5 rounded-md bg-zinc-300/50 dark:bg-zinc-800/80 shrink-0 mt-0.5">
                    <IconComponent className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 capitalize">{w.type_name}</span>
                    {w.description && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                        {w.description}
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
