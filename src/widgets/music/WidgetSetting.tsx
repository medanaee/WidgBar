import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { useTranslation } from '../../lib/i18n';

export default function MusicWidgetSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { t } = useTranslation();

    const coverAsBackground = config.coverAsBackground ?? false;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Cover Art as Background */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("musicCoverBg")}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("musicCoverBgDesc")}</p>
                </div>
                <Switch 
                    checked={coverAsBackground} 
                    onCheckedChange={(checked) => handleUpdate({ coverAsBackground: checked })} 
                />
            </SettingCard>
        </div>
    );
}
