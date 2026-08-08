import React, { useEffect } from 'react';
import { BotSparkle16Regular, BotSparkle20Regular } from '@fluentui/react-icons';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';
import { useTranslation } from '../../lib/i18n';

export default function AiBar({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const settings = useSettingsStore(state => state.settings) || {};
    const updateConstraints = useUpdateWidgetConstraints(widgetId);
    const { t } = useTranslation();

    const hideLabel = config.barHideLabel === true;
    const label = (config.barLabel as string | undefined)?.trim() || t('widgetAi');
    const barHeight = settings.barHeight || 36;
    const isLarge = barHeight >= 48;
    const Icon = isLarge ? BotSparkle20Regular : BotSparkle16Regular;

    useEffect(() => {
        updateConstraints({ squareInBar: hideLabel });
    }, [hideLabel, updateConstraints]);

    return (
        <div
            className={`text-zinc-800 dark:text-zinc-200 font-medium tracking-wide flex items-center select-none text-[11px] ${
                isLarge && !hideLabel ? 'flex-col gap-0.5' : 'flex-row gap-1'
            }`}
        >
            <Icon />
            {!hideLabel && <span className="leading-none truncate max-w-28">{label}</span>}
        </div>
    );
}
