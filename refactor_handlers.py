import re

def process():
    # 1. Read LayoutSettings.tsx
    with open('d:/Projects/window-test/src/components/LayoutSettings.tsx', 'r', encoding='utf-8') as f:
        layout_content = f.read()

    # Extract handlers from LayoutSettings
    onDragEnd_pattern = re.compile(r'  const onDragEnd = \(result: DropResult\) => \{.*?\n  \};\n\n', re.DOTALL)
    onDragEnd_match = onDragEnd_pattern.search(layout_content)
    onDragEnd_str = onDragEnd_match.group(0) if onDragEnd_match else ''
    
    handleAddSection_pattern = re.compile(r'  const handleAddSection = \(monitorId: string\) => \{.*?\n  \};\n', re.DOTALL)
    handleAddSection_match = handleAddSection_pattern.search(layout_content)
    handleAddSection_str = handleAddSection_match.group(0) if handleAddSection_match else ''
    
    handleRemoveSection_pattern = re.compile(r'  const handleRemoveSection = \(monitorId: string, sectionId: string\) => \{.*?\n  \};\n', re.DOTALL)
    handleRemoveSection_match = handleRemoveSection_pattern.search(layout_content)
    handleRemoveSection_str = handleRemoveSection_match.group(0) if handleRemoveSection_match else ''
    
    handleUpdateBarConfig_pattern = re.compile(r'  const handleUpdateBarConfig = \(monitorId: string, updates: any\) => \{.*?\n  \};\n', re.DOTALL)
    handleUpdateBarConfig_match = handleUpdateBarConfig_pattern.search(layout_content)
    handleUpdateBarConfig_str = handleUpdateBarConfig_match.group(0) if handleUpdateBarConfig_match else ''
    
    # Remove from LayoutSettings
    layout_content = layout_content.replace(onDragEnd_str, '')
    layout_content = layout_content.replace(handleAddSection_str, '')
    layout_content = layout_content.replace(handleRemoveSection_str, '')
    layout_content = layout_content.replace(handleUpdateBarConfig_str, '')
    
    # Remove imports no longer needed in LayoutSettings
    layout_content = layout_content.replace("import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';\n", "")
    layout_content = layout_content.replace("import { GripVertical } from 'lucide-react';\n", "")

    # Remove props passed to BarSettingsTab
    layout_content = layout_content.replace("                handleUpdateBarConfig={handleUpdateBarConfig}\n", "")
    layout_content = layout_content.replace("                handleAddSection={handleAddSection}\n", "")
    layout_content = layout_content.replace("                handleRemoveSection={handleRemoveSection}\n", "")
    layout_content = layout_content.replace("                onDragEnd={onDragEnd}\n", "")
    
    # Write back to LayoutSettings
    with open('d:/Projects/window-test/src/components/LayoutSettings.tsx', 'w', encoding='utf-8') as f:
        f.write(layout_content)
        
    # 2. Read BarSettingsTab.tsx
    with open('d:/Projects/window-test/src/components/BarSettingsTab.tsx', 'r', encoding='utf-8') as f:
        bar_content = f.read()
        
    # Add imports to BarSettingsTab
    bar_content = bar_content.replace("import React from 'react';", "import React from 'react';\nimport { useLayoutStore } from '../stores/layoutStore';")
    # Change DropResult import if needed
    if "DropResult" not in bar_content:
        bar_content = bar_content.replace("@hello-pangea/dnd';", "DropResult } from '@hello-pangea/dnd';")
        
    # Inject handlers into BarSettingsTab component
    # Need `currentLayout` and `layouts` which are used in handlers
    handlers_str = f"""
  const {{ layouts, currentLayout }} = useLayoutStore();
  
{onDragEnd_str}{handleAddSection_str}{handleRemoveSection_str}{handleUpdateBarConfig_str}
"""
    bar_content = bar_content.replace('}: any) {\n', '}: any) {\n' + handlers_str)
    
    # Remove props from BarSettingsTab definition
    props_to_remove = [
        "  handleUpdateBarConfig,\n",
        "  handleAddSection,\n",
        "  handleRemoveSection,\n",
        "  onDragEnd\n"
    ]
    for prop in props_to_remove:
        bar_content = bar_content.replace(prop, "")
        
    # Write back to BarSettingsTab
    with open('d:/Projects/window-test/src/components/BarSettingsTab.tsx', 'w', encoding='utf-8') as f:
        f.write(bar_content)
        
    print("Success")

process()
