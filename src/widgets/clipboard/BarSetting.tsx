import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { NumberInput } from '../../components/ui/NumberInput';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { useTranslation } from '../../lib/i18n';

const DEFAULT_TTL = 30;

function readShowRecent(config: Record<string, unknown>): boolean {
    if (typeof config.barShowRecent === 'boolean') return config.barShowRecent;
    // Legacy: if they had item count, assume recent was on
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

export default function ClipboardBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore((state) => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore((state) => state.updateInstance);
    const { t } = useTranslation();

    const barShowRecent = readShowRecent(config);
    const barItemCount = Math.min(3, Math.max(1, config.barItemCount ?? 2));
    const barRecentTimed = readTimed(config);
    const barRecentTtlSec = readTtl(config);

    const handleUpdate = (updates: Record<string, unknown>) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="rounded-xl border border-zinc-500/20 bg-white/50 dark:bg-zinc-900/10 shadow-sm overflow-hidden">
                <SettingCard className="border-0 shadow-none rounded-none bg-transparent">
                    <div className="flex-grow min-w-0 pr-3">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardShowRecent')}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('clipboardShowRecentDesc')}</p>
                    </div>
                    <Switch
                        checked={barShowRecent}
                        onCheckedChange={(checked) => handleUpdate({ barShowRecent: checked })}
                    />
                </SettingCard>

                {barShowRecent && (
                    <div className="flex items-center justify-between gap-3 px-3.5 pb-3.5 pt-0 border-t border-zinc-500/10">
                        <div className="min-w-0 pr-3 pt-3">
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardBarCount')}</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('clipboardBarCountDesc')}</p>
                        </div>
                        <div className="pt-3 shrink-0">
                            <NumberInput
                                min={1}
                                max={3}
                                step={1}
                                value={barItemCount}
                                onChange={(val) => handleUpdate({ barItemCount: val })}
                            />
                        </div>
                    </div>
                )}
            </div>

            {barShowRecent && (
                <div className="rounded-xl border border-zinc-500/20 bg-white/50 dark:bg-zinc-900/10 shadow-sm overflow-hidden">
                    <SettingCard className="border-0 shadow-none rounded-none bg-transparent">
                        <div className="flex-grow min-w-0 pr-3">
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardRecentTimed')}</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('clipboardRecentTimedDesc')}</p>
                        </div>
                        <Switch
                            checked={barRecentTimed}
                            onCheckedChange={(checked) => handleUpdate({ barRecentTimed: checked })}
                        />
                    </SettingCard>

                    {barRecentTimed && (
                        <div className="flex items-center justify-between gap-3 px-3.5 pb-3.5 pt-0 border-t border-zinc-500/10">
                            <div className="min-w-0 pr-3 pt-3">
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardRecentTtl')}</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('clipboardRecentTtlDesc')}</p>
                            </div>
                            <div className="pt-3 shrink-0">
                                <NumberInput
                                    min={1}
                                    max={86400}
                                    step={5}
                                    value={barRecentTtlSec}
                                    onChange={(val) => handleUpdate({ barRecentTtlSec: Math.max(1, val) })}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
