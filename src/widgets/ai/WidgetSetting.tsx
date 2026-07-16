import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useTranslation, TranslationKey } from '../../lib/i18n';

// Styled Card matching the Main layout settings card exactly
function SettingCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

export default function AiWidgetSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { data: aiData } = useAiServicesStore();
    const { t } = useTranslation();

    const selectedInstanceId = config.selectedInstanceId || '';
    const instances = aiData.instances || [];

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            <SettingCard>
                <div className="flex-1 mr-4">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">AI Service Instance</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose which configured AI instance this widget will use to chat</p>
                </div>
                {instances.length === 0 ? (
                    <span className="text-xs text-red-500 font-medium">No instances configured</span>
                ) : (
                    <Select
                        value={selectedInstanceId}
                        onValueChange={(val) => handleUpdate({ selectedInstanceId: val })}
                    >
                        <SelectTrigger className="w-44 h-8 px-3 text-xs bg-transparent">
                            <SelectValue placeholder="Select Instance" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {instances.map(inst => (
                                    <SelectItem key={inst.id} value={inst.id} className="text-xs">
                                        {inst.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                )}
            </SettingCard>
        </div>
    );
}
