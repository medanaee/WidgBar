import { useParams } from 'react-router-dom';
import { useLayoutStore } from '../stores/layoutStore';
import Widget from './Widget';

export default function Bar() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const { layouts, currentLayout } = useLayoutStore();
  const monitor = layouts[currentLayout]?.monitors.find(m => m.id === monitorId);
  const barSections = monitor?.barSections || [];
  const justify = monitor?.barJustify || "space-between";
  const spacing = monitor?.barWidgetSpacing ?? 8;
  const sectionSpacing = monitor?.barSectionSpacing ?? 16;
  const isSpacingJustify = ["start", "end", "center"].includes(justify);

  const justifyClass = {
    "start": "justify-start",
    "end": "justify-end",
    "center": "justify-center",
    "space-between": "justify-between",
    "space-around": "justify-around"
  }[justify] || "justify-between";

  return (
    <div 
      className={`w-full h-screen flex items-center px-4 shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.05)] select-none overflow-hidden ${justifyClass}`}
      style={{ gap: isSpacingJustify ? `${sectionSpacing}px` : undefined }}
    >
      {barSections.map(section => (
        <div key={section.id} className="flex items-center shrink-0" style={{ gap: `${spacing}px` }}>
          {section.widgets.map((widget, index) => (
            <Widget
              key={widget.id}
              context="bar"
              index={index}
              widget={widget}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
