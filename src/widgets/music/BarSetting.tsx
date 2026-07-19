import React from 'react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard } from '../../components/ui/SettingCard';
import { useTranslation } from '../../lib/i18n';

export default function MusicBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
    const { t } = useTranslation();

    const barShowCover = config.barShowCover ?? true;
    const barShowTime = config.barShowTime ?? true;
    const barShowProgress = config.barShowProgress ?? true;
    const barShowButtons = config.barShowButtons ?? true;

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Show Cover Art */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("musicShowCover")}</h3>
                </div>
                <Switch 
                    checked={barShowCover} 
                    onCheckedChange={(checked) => handleUpdate({ barShowCover: checked })} 
                />
            </SettingCard>

            {/* Show Duration */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("musicShowTime")}</h3>
                </div>
                <Switch 
                    checked={barShowTime} 
                    onCheckedChange={(checked) => handleUpdate({ barShowTime: checked })} 
                />
            </SettingCard>

            {/* Show Progress */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("musicShowProgress")}</h3>
                </div>
                <Switch 
                    checked={barShowProgress} 
                    onCheckedChange={(checked) => handleUpdate({ barShowProgress: checked })} 
                />
            </SettingCard>

            {/* Show Playback Controls */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("musicShowButtons")}</h3>
                </div>
                <Switch 
                    checked={barShowButtons} 
                    onCheckedChange={(checked) => handleUpdate({ barShowButtons: checked })} 
                />
            </SettingCard>
        </div>
    );
}
