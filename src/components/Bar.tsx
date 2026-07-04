import { useParams } from 'react-router-dom';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Settings16Regular, Settings20Regular, SettingsRegular } from '@fluentui/react-icons';
import { invoke } from '@tauri-apps/api/core';
import Widget from './Widget';

export default function Bar() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const { layouts, currentLayout } = useLayoutStore();
  const settings = useSettingsStore(state => state.settings);
  const monitor = layouts[currentLayout]?.monitors.find(m => m.id === monitorId);
  const barSections = monitor?.barSections || [];
  const justify = monitor?.barJustify || "space-between";
  const spacing = monitor?.barWidgetSpacing ?? 8;
  const sectionSpacing = monitor?.barSectionSpacing ?? 16;
  const isSpacingJustify = ["start", "end", "center"].includes(justify);
  const animate = settings?.barAnimate !== false;
  const showButton = monitor?.showMainWindowButton !== false;

  const justifyClass = {
    "start": "justify-start",
    "end": "justify-end",
    "center": "justify-center",
    "space-between": "justify-between",
    "space-around": "justify-around"
  }[justify] || "justify-between";

  const handleOpenMain = () => {
    invoke('show_window', { label: 'main' }).catch(console.error);
  };

  return (
    <div
      className={`w-full h-screen flex items-center pl-1 ${showButton ? 'pr-8' : 'pr-1'} shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.05)] select-none overflow-hidden relative ${justifyClass} ${animate ? 'transition-all duration-500 ease-in-out' : ''
        }`}
      style={{ gap: isSpacingJustify ? `${sectionSpacing}px` : undefined }}
    >
      {barSections.map(section => (
        <div
          key={section.id}
          className={`flex items-center shrink-0 ${animate ? 'transition-all duration-500 ease-in-out' : ''
            }`}
          style={{ gap: `${spacing}px` }}
        >
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

      {showButton && (
        <button
          onClick={handleOpenMain}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer z-50 flex items-center justify-center"
          title="Show Settings Window"
        >
          <SettingsRegular />
        </button>
      )}
    </div>
  );
}
