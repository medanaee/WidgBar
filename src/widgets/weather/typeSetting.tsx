import { useWidgetRegistryStore } from '../../stores/widgetRegistryStore';
import { NumberInput } from '../../components/ui/NumberInput';

export default function WeatherTypeSetting() {
    const registry = useWidgetRegistryStore(state => state.registry);
    const updateWidgetType = useWidgetRegistryStore(state => state.updateWidgetType);
    
    const widgetConfig = registry['weather'];
    if (!widgetConfig) return null;

    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
                <div className="flex-grow min-w-0 pr-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default Size</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Set the default width and height for all Weather widgets and Popups</p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex flex-col gap-1 items-center">
                        <label className="text-[10px] text-zinc-500 text-center">Width</label>
                        <NumberInput 
                            min={120} max={800} step={10}
                            value={widgetConfig.default_width || 300}
                            onChange={(val) => updateWidgetType('weather', { default_width: val })}
                        />
                    </div>
                    <span className="text-zinc-400 text-xs mt-4">x</span>
                    <div className="flex flex-col gap-1 items-center">
                        <label className="text-[10px] text-zinc-500 text-center">Height</label>
                        <NumberInput 
                            min={120} max={800} step={10}
                            value={widgetConfig.default_height || 150}
                            onChange={(val) => updateWidgetType('weather', { default_height: val })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
