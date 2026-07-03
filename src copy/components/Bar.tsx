import { useEffect } from "react";
import { useParams } from 'react-router-dom';
import { useLayoutStore } from '../stores/layoutStore';
import Widget from './Widget';

export default function Bar() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const { layouts, currentLayout } = useLayoutStore();
  const monitor = layouts[currentLayout]?.monitors.find(m => m.id === monitorId);
  const barWidgets = monitor?.bar || [];


  return (
    <div className="w-full h-screen flex items-center justify-center px-4 shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.05)] select-none overflow-hidden">
      <div className="flex items-center gap-4 h-full shrink-0">
        {barWidgets.map((widget, index) => (
          <Widget
            key={widget.id}
            context="bar"
            index={index}
            widget={widget}
          />
        ))}
      </div>
    </div>
  );
}
