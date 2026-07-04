import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { NumberInput } from "./ui/NumberInput";
import { SettingCard, SettingCardNoLayout } from "./ui/SettingCard";
import { ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor } from "@fluentui/react-icons";

const FluentIconMap: Record<string, React.ComponentType<any>> = {
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor
};

export default function BarSettingsTab({
  selectedMonitorId,
  monitors,
  settings,
  registry,
  t,
  language,
  handleMonitorToggle,
  handleUpdateBarConfig,
  handleAddSection,
  handleRemoveSection,
  setAddWidgetTarget,
  handleRemoveWidget,
  onDragEnd
}: any) {
  return (
    <TabsContent value="bar" className="animate-in fade-in duration-200 space-y-3 mt-0">
                <SettingCard>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("enableBar")}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("enableBarDesc")}</p>
                  </div>
                  <Switch
                    checked={monitors.find(m => m.id === selectedMonitorId)?.has_bar || false}
                    disabled={monitors.find(m => m.id === selectedMonitorId)?.is_primary}
                    onCheckedChange={(checked) => handleMonitorToggle(selectedMonitorId, "bar", checked)}
                  />
                </SettingCard>

                {monitors.find(m => m.id === selectedMonitorId)?.has_bar && (() => {
                  const currentMon = monitors.find(m => m.id === selectedMonitorId)!;
                  return (
                    <div className="space-y-4 pt-4 border-t border-zinc-500/20">
                      {/* Bar Configuration */}
                      <SettingCardNoLayout>
                        <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Layout Settings</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Justify Sections</span>
                          <Select
                            value={currentMon.barJustify || "space-between"}
                            onValueChange={(val) => handleUpdateBarConfig(selectedMonitorId, { barJustify: val })}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs bg-transparent" dir={language === 'fa' ? 'rtl' : 'ltr'}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir={language === 'fa' ? 'rtl' : 'ltr'}>
                              <SelectGroup>
                                <SelectItem value="start" className="text-xs">Start</SelectItem>
                                <SelectItem value="center" className="text-xs">Center</SelectItem>
                                <SelectItem value="end" className="text-xs">End</SelectItem>
                                <SelectItem value="space-between" className="text-xs">Space Between</SelectItem>
                                <SelectItem value="space-around" className="text-xs">Space Around</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-500/10">
                          <span className="text-sm font-medium">Widget Spacing (px)</span>
                          <NumberInput
                            value={currentMon.barWidgetSpacing ?? 8}
                            min={0}
                            max={64}
                            onChange={(val) => handleUpdateBarConfig(selectedMonitorId, { barWidgetSpacing: val })}
                          />
                        </div>

                        {["start", "end", "center"].includes(currentMon.barJustify || "space-between") && (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-500/10">
                            <span className="text-sm font-medium">Section Spacing (px)</span>
                            <NumberInput
                              value={currentMon.barSectionSpacing ?? 16}
                              min={0}
                              max={128}
                              onChange={(val) => handleUpdateBarConfig(selectedMonitorId, { barSectionSpacing: val })}
                            />
                          </div>
                        )}
                      </SettingCardNoLayout>

                      {/* Sections Header */}
                      <div className="flex items-center justify-between pt-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bar Sections</h3>
                        <button
                          onClick={() => handleAddSection(selectedMonitorId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Section
                        </button>
                      </div>

                      {/* Sections List */}
                      <DragDropContext onDragEnd={onDragEnd}>
                      <div className="flex flex-col gap-4">
                        {(currentMon.barSections || []).map((section, sIndex) => (
                          <div key={section.id} className="border border-zinc-500/20 rounded-lg overflow-hidden flex flex-col bg-zinc-50/50 dark:bg-zinc-900/20">
                            <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 p-2.5 border-b border-zinc-500/20">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{section.name}</span>
                                <span className="text-[10px] text-zinc-500">{section.widgets.length} widgets</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setAddWidgetTarget({ context: "bar", sectionId: section.id })}
                                  className="flex items-center gap-1 px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Widget
                                </button>
                                <button onClick={() => handleRemoveSection(selectedMonitorId, section.id)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete Section">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <Droppable droppableId={section.id}>
                              {(provided, snapshot) => (
                                <div 
                                  className={`p-2 flex flex-col gap-1.5 min-h-[50px] transition-colors rounded-b-lg ${snapshot.isDraggingOver ? 'bg-zinc-100 dark:bg-zinc-800/60' : ''}`}
                                  {...provided.droppableProps} 
                                  ref={provided.innerRef}
                                >
                                  {section.widgets.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-zinc-500">No widgets in this section</div>
                                  ) : (
                                    section.widgets.map((widget, i) => {
                                      const wType = registry[widget.type];
                                      const IconComponent = wType ? (FluentIconMap[wType.icon] || LayoutGrid) : LayoutGrid;
                                      return (
                                        <Draggable key={widget.id} draggableId={widget.id} index={i}>
                                          {(provided, snapshot) => (
                                            <div 
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className={`flex items-center justify-between p-2 rounded-md bg-white dark:bg-zinc-800/50 border shadow-sm transition-all ${snapshot.isDragging ? 'border-indigo-500 shadow-md rotate-1 z-50' : 'border-zinc-500/10'}`}
                                            >
                                              <div className="flex items-center gap-3">
                                                <div 
                                                  {...provided.dragHandleProps}
                                                  className="shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-zinc-100 dark:hover:bg-zinc-700 p-1 rounded"
                                                >
                                                  <GripVertical className="w-4 h-4 text-zinc-400" />
                                                </div>
                                                <div className="shrink-0 flex items-center justify-center">
                                                  <IconComponent className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
                                                </div>
                                                <div className="flex flex-col items-start">
                                                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200 capitalize">{widget.type}</span>
                                                  <span className="text-[10px] text-zinc-500">Pos: {i + 1}</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <button onClick={() => handleRemoveWidget(selectedMonitorId, widget.id, { context: "bar", sectionId: section.id })} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        ))}
                        {(currentMon.barSections?.length === 0 || !currentMon.barSections) && (
                          <div className="text-center py-6 text-sm text-zinc-500 border border-dashed border-zinc-500/30 rounded-lg">
                            No sections added. Add a section first!
                          </div>
                        )}
                      </div>
                      </DragDropContext>
                    </div>
                  );
                })()}
              </TabsContent>
  );
}
