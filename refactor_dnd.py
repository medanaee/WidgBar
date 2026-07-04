import re
with open('d:/Projects/window-test/src/components/LayoutSettings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
imports = """import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
"""
content = content.replace('import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";', imports + 'import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";')

# Add onDragEnd function inside LayoutSettings
drag_func = """
  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newLayouts = { ...layouts };
    const monitorIndex = newLayouts[currentLayout].monitors.findIndex(m => m.id === selectedMonitorId);
    if (monitorIndex === -1) return;

    const monitor = newLayouts[currentLayout].monitors[monitorIndex];
    if (!monitor.barSections) return;

    const sourceSectionIndex = monitor.barSections.findIndex(s => s.id === source.droppableId);
    const destSectionIndex = monitor.barSections.findIndex(s => s.id === destination.droppableId);
    
    if (sourceSectionIndex === -1 || destSectionIndex === -1) return;

    const sourceSection = monitor.barSections[sourceSectionIndex];
    const destSection = monitor.barSections[destSectionIndex];

    const sourceWidgets = Array.from(sourceSection.widgets);
    const destWidgets = sourceSection.id === destSection.id ? sourceWidgets : Array.from(destSection.widgets);

    const [movedWidget] = sourceWidgets.splice(source.index, 1);
    destWidgets.splice(destination.index, 0, movedWidget);

    monitor.barSections[sourceSectionIndex].widgets = sourceWidgets;
    if (sourceSection.id !== destSection.id) {
      monitor.barSections[destSectionIndex].widgets = destWidgets;
    }

    useLayoutStore.getState().setLayouts(newLayouts);
  };
"""
content = content.replace('if (!selectedMonitorId) return null;', 'if (!selectedMonitorId) return null;\n' + drag_func)

# Wrap Sections List
# Find: <div className="flex flex-col gap-4">
# Replace: <DragDropContext onDragEnd={onDragEnd}>\n<div className="flex flex-col gap-4">
content = content.replace('<div className="flex flex-col gap-4">', '<DragDropContext onDragEnd={onDragEnd}>\n                      <div className="flex flex-col gap-4">')
# Close DragDropContext right after the sections mapping loop
content = content.replace("""                        {(currentMon.barSections?.length === 0 || !currentMon.barSections) && (
                          <div className="text-center py-6 text-sm text-zinc-500 border border-dashed border-zinc-500/30 rounded-lg">
                            No sections added. Add a section first!
                          </div>
                        )}
                      </div>""", """                        {(currentMon.barSections?.length === 0 || !currentMon.barSections) && (
                          <div className="text-center py-6 text-sm text-zinc-500 border border-dashed border-zinc-500/30 rounded-lg">
                            No sections added. Add a section first!
                          </div>
                        )}
                      </div>
                      </DragDropContext>""")

# Replace inner widgets rendering with Droppable
old_inner = """                            <div className="p-2 flex flex-col gap-1.5">
                              {section.widgets.length === 0 ? (
                                <div className="text-center py-4 text-xs text-zinc-500">No widgets in this section</div>
                              ) : (
                                section.widgets.map((widget, i) => {
                                  const wType = registry[widget.type];
                                  const IconComponent = wType ? (FluentIconMap[wType.icon] || LayoutGrid) : LayoutGrid;
                                  return (
                                    <div key={widget.id} className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-zinc-800/50 border border-zinc-500/10 shadow-sm transition-colors">
                                      <div className="flex items-center gap-3">
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
                                  );
                                })
                              )}
                            </div>"""

new_inner = """                            <Droppable droppableId={section.id}>
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
                            </Droppable>"""

content = content.replace(old_inner, new_inner)

with open('d:/Projects/window-test/src/components/LayoutSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
