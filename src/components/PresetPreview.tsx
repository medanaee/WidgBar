import React from 'react';
import { WidgetIcon } from './WidgetIcon';
import { BarPresetExport, DesktopAreaPresetExport, PresetExport } from '../lib/presetExportImport';
import { useTranslation } from '../lib/i18n';
import { useWidgetRegistryStore } from '../stores/widgetRegistryStore';

interface PresetPreviewProps {
  preset: PresetExport;
}

export function PresetPreview({ preset }: PresetPreviewProps) {
  const { t } = useTranslation();
  const { registry } = useWidgetRegistryStore();

  if (preset.type === 'bar') {
    const barPreset = preset as BarPresetExport;
    const sections = barPreset.barSections || [];
    const allWidgets = sections.flatMap((sec) => sec.widgets || []);

    return (
      <div className="w-full flex flex-col gap-2.5 my-1">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{t("barPreview")}</span>
          <span>{t("totalWidgets")} <strong className="text-zinc-800 dark:text-zinc-200">{allWidgets.length}</strong></span>
        </div>

        {/* Bar Strip with Section Rectangles */}
        <div className="w-full p-1.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 border border-zinc-500/20 shadow-inner flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
          {sections.length === 0 || allWidgets.length === 0 ? (
            <div className="w-full text-center text-xs text-zinc-400 py-1">
              {t("noWidgetsInBar")}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full justify-between px-1">
              {sections.map((sec, secIdx) => (
                <div
                  key={sec.id || secIdx}
                  className="flex items-center gap-1.5 p-1 px-1 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-zinc-400/30 dark:border-zinc-600/40 shadow-xs shrink-0"
                >
                  {(sec.widgets || []).map((w, wIdx) => {
                    const wType = registry[w.widgetType];
                    const label = wType ? t(wType.nameKey as any) : w.widgetType;
                    return (
                      <div
                        key={wIdx}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-500/10 text-xs font-medium text-zinc-800 dark:text-zinc-200 shrink-0"
                        title={label}
                      >
                        <WidgetIcon type={w.widgetType} className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[90px]">{label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop Area Preview
  const areaPreset = preset as DesktopAreaPresetExport;
  const widgets = areaPreset.widgets || [];

  // Calculate true bounding screen bounds based on widget coordinates (default 1920x1080)
  let boundsW = 1920;
  let boundsH = 1080;
  widgets.forEach((w) => {
    if (w.x + w.width > boundsW) boundsW = w.x + w.width;
    if (w.y + w.height > boundsH) boundsH = w.y + w.height;
  });

  return (
    <div className="w-full flex flex-col gap-2 my-1">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{t("desktopPreview")}</span>
        <span>{t("desktopWidgetsCount")} <strong className="text-zinc-800 dark:text-zinc-200">{widgets.length}</strong></span>
      </div>

      {/* Mini Desktop Canvas Grid (16:9 Aspect Ratio) */}
      <div className="relative w-full aspect-video rounded-xl bg-zinc-950/90 border border-zinc-500/20 overflow-hidden shadow-inner flex items-center justify-center">
        {/* Subtle Grid Pattern */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        {widgets.length === 0 ? (
          <div className="text-xs text-zinc-500">
            {t("noDesktopWidgets")}
          </div>
        ) : (
          widgets.map((w, idx) => {
            // Exact percentage coordinates based on boundsW and boundsH
            const leftPct = (w.x / boundsW) * 100;
            const topPct = (w.y / boundsH) * 100;
            const widthPct = Math.max(8, (w.width / boundsW) * 100);
            const heightPct = Math.max(12, (w.height / boundsH) * 100);

            const wType = registry[w.widgetType];
            const label = wType ? t(wType.nameKey as any) : w.widgetType;

            return (
              <div
                key={idx}
                className="absolute rounded-lg bg-zinc-800/90 border border-zinc-500/40 shadow-md p-1 flex flex-col items-center justify-center gap-0.5 overflow-hidden"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                }}
                title={`${label} (${w.x}, ${w.y}) - ${w.width}x${w.height}`}
              >
                <WidgetIcon type={w.widgetType} className="w-5 h-5 opacity-90 shrink-0" />
                <span className="text-[9px] font-medium text-zinc-300 truncate w-full text-center leading-none px-0.5">
                  {label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
