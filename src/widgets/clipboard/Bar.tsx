import { useEffect, useLayoutEffect } from 'react';
import { Clipboard, Pin } from 'lucide-react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useClipboardStore, subscribeClipboardSync } from '../../stores/clipboardStore';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { FileTypeIcon } from './FileTypeIcon';
import {
    clipboardPasteHover,
    imageSrc,
    pasteClipboardItem,
    resetClipboardPasteHover,
    useBarClipboardItems,
    type ClipboardItem,
} from './clipboardApi';

const DEFAULT_TTL = 30;

function readShowRecent(config: Record<string, unknown>): boolean {
    if (typeof config.barShowRecent === 'boolean') return config.barShowRecent;
    return true;
}

function readTimed(config: Record<string, unknown>): boolean {
    if (typeof config.barRecentTimed === 'boolean') return config.barRecentTimed;
    if (typeof config.barRecentPermanent === 'boolean') return !config.barRecentPermanent;
    const legacy = config.barSlotPermanent;
    if (Array.isArray(legacy)) return !legacy[0];
    return true;
}

function readTtl(config: Record<string, unknown>): number {
    if (typeof config.barRecentTtlSec === 'number') return config.barRecentTtlSec;
    const legacy = config.barSlotTtlSec;
    if (Array.isArray(legacy) && typeof legacy[0] === 'number') return legacy[0];
    return DEFAULT_TTL;
}

function Chip({
    item,
    large,
    maxWidth,
}: {
    item: ClipboardItem;
    large: boolean;
    maxWidth: number;
}) {
    const src = item.kind === 'image' ? imageSrc(item.imagePath) : null;
    const isFiles = item.kind === 'files';
    const label = item.kind === 'image' ? 'Image' : item.preview || '…';
    const stackPinFile = large && item.pinned && isFiles;

    return (
        <button
            type="button"
            onMouseEnter={() => clipboardPasteHover(true)}
            onMouseLeave={() => clipboardPasteHover(false)}
            onClick={(e) => {
                e.stopPropagation();
                pasteClipboardItem(item).catch(console.error);
            }}
            style={{ maxWidth }}
            className={`shrink-0 flex items-center gap-0.5 rounded-md bg-zinc-900/10 hover:bg-zinc-900/15 dark:bg-white/10 dark:hover:bg-white/20 transition-colors text-left h-full px-1 py-0.5 `}
        >
            {stackPinFile ? (
                <span className="flex flex-col items-center justify-center gap-0.5 shrink-0">
                    <Pin className="w-3.5 h-3.5 text-zinc-700 dark:text-white/90" />
                    <FileTypeIcon paths={item.filePaths} size={14} />
                </span>
            ) : (
                <>
                    {item.pinned ? (
                        <Pin className="w-3.5 h-3.5 shrink-0 text-zinc-700 dark:text-white/90" />
                    ) : null}
                    {isFiles ? (
                        <FileTypeIcon paths={item.filePaths} size={16} />
                    ) : null}
                </>
            )}

            {src && (
                <img
                    src={src}
                    alt=""
                    className="h-full max-h-12 aspect-square rounded object-cover shrink-0"
                />
            )}

            {!src && (
                <span
                    className={`min-w-0 flex-1 text-zinc-800 dark:text-zinc-100 px-1 ${
                        large
                            ? 'text-[10px] leading-[1.15em] line-clamp-3'
                            : 'text-[10px] truncate'
                    }`}
                >
                    {label}
                </span>
            )}
        </button>
    );
}

export default function ClipboardBar({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore((s) => s.instances[widgetId]) || {};
    const settings = useSettingsStore((s) => s.settings) || {};
    const updateConstraints = useUpdateWidgetConstraints(widgetId);
    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;

    const barShowRecent = readShowRecent(config);
    const barItemCount = Math.min(3, Math.max(1, config.barItemCount ?? 2));
    const barRecentTimed = readTimed(config);
    const barRecentTtlSec = readTtl(config);
    const pinnedMaxW = Math.min(100, Math.max(60, config.barPinnedChipMaxW ?? 72));
    const recentMaxW = Math.min(100, Math.max(60, config.barRecentChipMaxW ?? 60));

    const items = useClipboardStore((s) => s.items);
    const barItems = useBarClipboardItems(items, {
        barShowRecent,
        barItemCount,
        barRecentTimed,
        barRecentTtlSec,
    });

    useLayoutEffect(() => {
        updateConstraints({ alwaysOnTop: true, closeOnBlur: false });
    }, [updateConstraints]);

    useEffect(() => {
        const unsubscribe = subscribeClipboardSync();
        return () => {
            unsubscribe();
            resetClipboardPasteHover();
        };
    }, []);

    return (
        <div className="text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 select-none h-full px-0.5">
            <Clipboard className={isLarge ? 'w-4 h-4 shrink-0 opacity-90' : 'w-3.5 h-3.5 shrink-0 opacity-90'} />
            {barItems.map((item) => (
                <Chip
                    key={item.id}
                    item={item}
                    large={isLarge}
                    maxWidth={item.pinned ? pinnedMaxW : recentMaxW}
                />
            ))}
        </div>
    );
}
