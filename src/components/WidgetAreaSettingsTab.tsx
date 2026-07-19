import React from 'react';
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Settings as SettingsIcon, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { SettingCard } from "./ui/SettingCard";
import { useLayoutStore } from "../stores/layoutStore";
import { emit } from "@tauri-apps/api/event";
import { WidgetIcon } from './WidgetIcon';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useTranslation } from "../lib/i18n";



export default function WidgetAreaSettingsTab({
  selectedMonitorId,
  monitors,
  layouts,
  currentLayout,
  registry,
  t,
  handleMonitorToggle,
  hoveredWidgetId,
  setHoveredWidgetId,
  setAddWidgetTarget,
  setEditingWidget,
  handleRemoveWidget
}: any) {
  React.useEffect(() => {
    return () => {
      if (hoveredWidgetId) {
        setHoveredWidgetId(null);
        emit('widget-highlight', { widgetId: hoveredWidgetId, isHighlighted: false }).catch(console.error);
      }
    };
  }, [hoveredWidgetId, setHoveredWidgetId]);

  return (
    <TabsContent value="widgets" className="animate-in fade-in duration-200 space-y-3 mt-0">
      <SettingCard>
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("enableWidgetArea")}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("enableWidgetAreaDesc")}</p>
        </div>
        <Switch
          checked={monitors.find(m => m.id === selectedMonitorId)?.has_widget_area || false}
          onCheckedChange={(checked) => handleMonitorToggle(selectedMonitorId, "widgetArea", checked)}
        />
      </SettingCard>

      {(() => {
        const currentMon = monitors.find((m: any) => m.id === selectedMonitorId);
        if (!currentMon?.has_widget_area) return null;
        
        const isBorrowing = !!currentMon.borrowAreaLayoutFrom;
        const targetMon = (currentMon.borrowAreaLayoutFrom && 
                           monitors.find((m: any) => m.id === currentMon.borrowAreaLayoutFrom && !m.borrowAreaLayoutFrom)) || currentMon;

        return (
          <div className="space-y-3 pt-4 border-t border-zinc-500/20">
            {/* Borrow Layout Card */}
            <SettingCard>
              <div className="flex-grow min-w-0 pr-3">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("borrowWidgetLayout")}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("borrowWidgetLayoutDesc")}
                </p>
              </div>
              <Select
                value={currentMon.borrowAreaLayoutFrom || "none"}
                onValueChange={(val) => {
                  const borrowId = val === "none" ? undefined : val;
                  const newLayouts = { ...layouts };
                  const mIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === selectedMonitorId);
                  if (mIndex > -1) {
                    newLayouts[currentLayout].monitors[mIndex].borrowAreaLayoutFrom = borrowId;
                    useLayoutStore.getState().setLayouts(newLayouts);
                  }
                }}
              >
                <SelectTrigger className="w-56 h-8 text-xs bg-transparent border-zinc-500/20">
                  <SelectValue placeholder="Select monitor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none" className="text-xs">
                      {t("borrowNone")}
                    </SelectItem>
                    {monitors
                      .filter((m: any) => m.id !== selectedMonitorId && m.has_widget_area && !m.borrowAreaLayoutFrom)
                      .map((m: any, idx: number) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {t("borrowMonitorLabel")} {idx + 1} ({m.name || m.id})
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </SettingCard>

            {/* Warning Banner */}
            {isBorrowing && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex flex-col gap-1 leading-normal animate-in fade-in duration-200">
                <span className="font-semibold">
                  {t("borrowWidgetLayoutWarning")}
                </span>
                <span>
                  {t("borrowWidgetLayoutWarningDesc")}
                </span>
              </div>
            )}

            {/* Rest of Settings */}
            <div className={`space-y-3 ${isBorrowing ? "pointer-events-none opacity-50 select-none" : ""}`}>
              <SettingCard>
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Edit Mode</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Unlock widgets to move and resize them</p>
                </div>
                <Switch
                  checked={targetMon?.isEditMode || false}
                  onCheckedChange={(checked) => {
                    const newLayouts = { ...layouts };
                    const mIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === targetMon.id);
                    if (mIndex > -1) {
                      newLayouts[currentLayout].monitors[mIndex].isEditMode = checked;
                      useLayoutStore.getState().setLayouts(newLayouts);
                    }
                  }}
                />
              </SettingCard>

              {/* Monitor Mini Map */}
              <div className="w-full flex justify-center py-2">
                <div
                  className="relative bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-inner max-w-[280px] w-full"
                  style={{ aspectRatio: `${targetMon?.width} / ${targetMon?.height}` }}
                >
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
                  {targetMon?.widgetArea.map(w => {
                    const isHovered = w.id === hoveredWidgetId;
                    const scale = (targetMon.scale_factor || 1) * window.devicePixelRatio;
                    const mWidth = targetMon.width / scale;
                    const mHeight = targetMon.height / scale;

                    return (
                      <div
                        key={w.id}
                        className={`absolute rounded-xs transition-all duration-200 border border-zinc-500/30 ${isHovered ? 'bg-indigo-500/50 z-10 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-400/20 dark:bg-zinc-600/30'}`}
                        style={{
                          left: `${(w.x / mWidth) * 100}%`,
                          top: `${(w.y / mHeight) * 100}%`,
                          width: `${(w.width / mWidth) * 100}%`,
                          height: `${(w.height / mHeight) * 100}%`
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Desktop Widgets</h3>
                <button
                  onClick={() => setAddWidgetTarget({ context: "widgetArea" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Widget
                </button>
              </div>
              
              <div className="flex flex-col gap-2">
                {targetMon?.widgetArea.map(widget => {
                  const wType = registry[widget.type];
                  return (
                    <div
                      key={widget.id}
                      onMouseEnter={() => {
                        setHoveredWidgetId(widget.id);
                        emit('widget-highlight', { widgetId: widget.id, isHighlighted: true }).catch(console.error);
                      }}
                      onMouseLeave={() => {
                        setHoveredWidgetId(null);
                        emit('widget-highlight', { widgetId: widget.id, isHighlighted: false }).catch(console.error);
                      }}
                    >
                      <SettingCard>
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 flex items-center justify-center">
                            <WidgetIcon type={widget.type} className="w-8 h-8 opacity-90 drop-shadow-sm" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 capitalize">
                              {wType ? t(wType.nameKey as any) : widget.type}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Size: {Math.round(widget.width)}x{Math.round(widget.height)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingWidget({ widget, context: 'Area' })}
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                            title="Settings"
                          >
                            <SettingsIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveWidget(targetMon.id, widget.id, { context: "widgetArea" })} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </SettingCard>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </TabsContent>
  );
}
