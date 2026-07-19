import { useWidgetRegistryStore } from '../../stores/widgetRegistryStore';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { NumberInput } from '../../components/ui/NumberInput';
import { SettingCardNoLayout } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useTranslation } from '@/lib/i18n';
import { AI_PROVIDERS } from '../../types/ai';
import { aiManager } from '../../lib/AiServicesManager';

export default function ClipboardTypeSetting() {
    const registry = useWidgetRegistryStore((state) => state.registry);
    const updateWidgetType = useWidgetRegistryStore((state) => state.updateWidgetType);
    const instances = useAiServicesStore((state) => state.data.instances);
    const sessions = useAiServicesStore((state) => state.data.sessions);
    const { t, language } = useTranslation();
    const dir = language === 'fa' ? 'rtl' : 'ltr';

    const widgetConfig = registry['clipboard'];
    if (!widgetConfig) return null;

    const instanceId = widgetConfig.aiInstanceId || '';
    const sessionId = widgetConfig.aiSessionId || '';
    const instanceSessions = sessions.filter((s) => s.instanceId === instanceId);

    const handleInstanceChange = (id: string) => {
        const forInstance = sessions.filter((s) => s.instanceId === id);
        const nextSession =
            forInstance.find((s) => s.title === 'Clipboard')?.id ||
            forInstance[0]?.id ||
            aiManager.createSession(id, 'Clipboard').id;
        updateWidgetType('clipboard', { aiInstanceId: id, aiSessionId: nextSession });
    };

    const handleSessionChange = (id: string) => {
        updateWidgetType('clipboard', { aiSessionId: id });
    };

    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardDefaultSize')}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('clipboardDefaultSizeDesc')}</p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex flex-col gap-1 items-center">
                        <label className="text-[10px] text-zinc-500 text-center">{t('clipboardWidth')}</label>
                        <NumberInput
                            min={200} max={800} step={10}
                            value={widgetConfig.default_width || 360}
                            onChange={(val) => updateWidgetType('clipboard', { default_width: val })}
                        />
                    </div>
                    <span className="text-zinc-400 text-xs mt-4">x</span>
                    <div className="flex flex-col gap-1 items-center">
                        <label className="text-[10px] text-zinc-500 text-center">{t('clipboardHeight')}</label>
                        <NumberInput
                            min={200} max={900} step={10}
                            value={widgetConfig.default_height || 420}
                            onChange={(val) => updateWidgetType('clipboard', { default_height: val })}
                        />
                    </div>
                </div>
            </div>

            <SettingCardNoLayout className="space-y-3">
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('clipboardAiTarget')}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('clipboardAiTargetDesc')}</p>
                </div>

                {instances.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{t('clipboardNoAiServices')}</p>
                ) : (
                    <>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('clipboardAiInstance')}</label>
                            <Select value={instanceId || undefined} onValueChange={handleInstanceChange}>
                                <SelectTrigger className="w-full h-8 text-xs bg-transparent" dir={dir}>
                                    <SelectValue placeholder={t('clipboardSelectInstance')} />
                                </SelectTrigger>
                                <SelectContent dir={dir}>
                                    <SelectGroup>
                                        {instances.map((inst) => {
                                            const provider = AI_PROVIDERS.find((p) => p.id === inst.providerId)?.name || inst.providerId;
                                            return (
                                                <SelectItem key={inst.id} value={inst.id} className="text-xs">
                                                    {inst.name} · {provider}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        {instanceId && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('clipboardAiSession')}</label>
                                <Select
                                    value={sessionId && instanceSessions.some((s) => s.id === sessionId) ? sessionId : undefined}
                                    onValueChange={handleSessionChange}
                                >
                                    <SelectTrigger className="w-full h-8 text-xs bg-transparent" dir={dir}>
                                        <SelectValue placeholder={t('clipboardSelectSession')} />
                                    </SelectTrigger>
                                    <SelectContent dir={dir}>
                                        <SelectGroup>
                                            {instanceSessions.length === 0 ? (
                                                <SelectItem value="__none" disabled className="text-xs">
                                                    {t('clipboardNoSessions')}
                                                </SelectItem>
                                            ) : (
                                                instanceSessions.map((s) => (
                                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                                        {s.title || 'Chat'}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-zinc-500">{t('clipboardAiSessionHint')}</p>
                            </div>
                        )}
                    </>
                )}
            </SettingCardNoLayout>
        </div>
    );
}
