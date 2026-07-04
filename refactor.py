import re
with open('d:/Projects/window-test/src/components/Main.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { SettingCard, SettingCardNoLayout } from "./ui/SettingCard";', 'import { SettingCard, SettingCardNoLayout } from "./ui/SettingCard";\nimport LayoutSettings from "./LayoutSettings";')

states_to_remove = [
    '  const [addWidgetTarget, setAddWidgetTarget] = useState<{ context: "bar"; sectionId: string } | { context: "widgetArea" } | null>(null);\n',
    '  const [editingWidget, setEditingWidget] = useState<DesktopWidget | null>(null);\n',
    '  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);\n',
    '  const [layoutInnerTab, setLayoutInnerTab] = useState<"bar" | "widgets">("bar");\n'
]
for state in states_to_remove:
    content = content.replace(state, '')

pattern_handlers = re.compile(r'  const handleMonitorToggle = async \(.*?\}\s*\}\s*useLayoutStore\.getState\(\)\.setLayouts\(newLayouts\);\n  \};\n', re.DOTALL)
content = re.sub(pattern_handlers, '', content)

pattern_jsx = re.compile(r'\{activeTab === "layout" && selectedMonitorId && editingWidget \? \((.*?)\) : null\}', re.DOTALL)
content = re.sub(pattern_jsx, '{activeTab === "layout" && <LayoutSettings selectedMonitorId={selectedMonitorId} />}', content)

pattern_modal = re.compile(r'\{/\* The new Custom Popup Modal \*/\}.*?</CutoutProvider>', re.DOTALL)
content = re.sub(pattern_modal, '</CutoutProvider>', content)

with open('d:/Projects/window-test/src/components/Main.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
