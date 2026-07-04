import re

with open('d:/Projects/window-test/src/components/LayoutSettings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bar_start_idx = content.find('<TabsContent value="bar"')
widgets_start_idx = content.find('<TabsContent value="widgets"')
widgets_end_idx = content.find('</TabsContent>', widgets_start_idx) + len('</TabsContent>')
bar_end_idx = content.find('</TabsContent>', bar_start_idx, widgets_start_idx) + len('</TabsContent>')

bar_content = content[bar_start_idx:bar_end_idx]
widgets_content = content[widgets_start_idx:widgets_end_idx]

bar_file_content = f"""import React from 'react';
import {{ DragDropContext, Droppable, Draggable }} from '@hello-pangea/dnd';
import {{ GripVertical, Plus, Trash2, LayoutGrid }} from 'lucide-react';
import {{ Switch }} from "@/components/ui/switch";
import {{ TabsContent }} from "@/components/ui/tabs";
import {{ Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue }} from "./ui/select";
import {{ NumberInput }} from "./ui/NumberInput";
import {{ SettingCard, SettingCardNoLayout }} from "./ui/SettingCard";
import {{ ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor }} from "@fluentui/react-icons";

const FluentIconMap: Record<string, React.ComponentType<any>> = {{
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor
}};

export default function BarSettingsTab({{
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
}}: any) {{
  return (
    {bar_content}
  );
}}
"""

widgets_file_content = f"""import React from 'react';
import {{ Switch }} from "@/components/ui/switch";
import {{ TabsContent }} from "@/components/ui/tabs";
import {{ Settings as SettingsIcon, LayoutGrid, Plus, Trash2 }} from 'lucide-react';
import {{ SettingCard }} from "./ui/SettingCard";
import {{ useLayoutStore }} from "../stores/layoutStore";
import {{ ClockColor, ClipboardTaskColor, CalendarColor, ClockAlarmColor }} from "@fluentui/react-icons";

const FluentIconMap: Record<string, React.ComponentType<any>> = {{
  ClockColor,
  ClipboardTaskColor,
  CalendarColor,
  ClockAlarmColor
}};

export default function WidgetAreaSettingsTab({{
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
}}: any) {{
  return (
    {widgets_content}
  );
}}
"""

with open('d:/Projects/window-test/src/components/BarSettingsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(bar_file_content)

with open('d:/Projects/window-test/src/components/WidgetAreaSettingsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(widgets_file_content)

new_content = content[:bar_start_idx] + """
              <BarSettingsTab
                selectedMonitorId={selectedMonitorId}
                monitors={monitors}
                settings={settings}
                registry={registry}
                t={t}
                language={language}
                handleMonitorToggle={handleMonitorToggle}
                handleUpdateBarConfig={handleUpdateBarConfig}
                handleAddSection={handleAddSection}
                handleRemoveSection={handleRemoveSection}
                setAddWidgetTarget={setAddWidgetTarget}
                handleRemoveWidget={handleRemoveWidget}
                onDragEnd={onDragEnd}
              />
              
              <WidgetAreaSettingsTab
                selectedMonitorId={selectedMonitorId}
                monitors={monitors}
                layouts={layouts}
                currentLayout={currentLayout}
                registry={registry}
                t={t}
                handleMonitorToggle={handleMonitorToggle}
                hoveredWidgetId={hoveredWidgetId}
                setHoveredWidgetId={setHoveredWidgetId}
                setAddWidgetTarget={setAddWidgetTarget}
                setEditingWidget={setEditingWidget}
                handleRemoveWidget={handleRemoveWidget}
              />
""" + content[widgets_end_idx:]

new_content = "import BarSettingsTab from './BarSettingsTab';\nimport WidgetAreaSettingsTab from './WidgetAreaSettingsTab';\n" + new_content

with open('d:/Projects/window-test/src/components/LayoutSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Success')
