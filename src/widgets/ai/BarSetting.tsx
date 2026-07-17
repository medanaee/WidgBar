import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { Switch } from '../../components/ui/switch';

function SettingCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
            {children}
        </div>
    );
}

export default function AiBarSetting({ widgetId }: { widgetId: string }) {
    const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const updateInstance = useWidgetInstanceStore(state => state.updateInstance);

    const handleUpdate = (updates: any) => {
        updateInstance(widgetId, { ...config, ...updates });
    };

    return (
        <div className="space-y-3 pt-2">
            {/* Click to Open Details */}
            <SettingCard>
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to Open</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow clicking the AI icon in the bar to open the chat popup</p>
                </div>
                <Switch 
                    checked={!config.disableClickPopup} 
                    onCheckedChange={(checked) => handleUpdate({ disableClickPopup: !checked })} 
                />
            </SettingCard>

            {/* Popup Size */}
            <div className="p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm space-y-4">
                <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Popup Size</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Adjust the dimensions of the AI chat window</p>
                </div>
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Width</span>
                            <span className="text-zinc-500">{config.popupWidth || 350}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="250" max="800" step="10"
                            value={config.popupWidth || 350}
                            onChange={(e) => handleUpdate({ popupWidth: Number(e.target.value) })}
                            className="w-full accent-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Height</span>
                            <span className="text-zinc-500">{config.popupHeight || 400}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="300" max="800" step="10"
                            value={config.popupHeight || 400}
                            onChange={(e) => handleUpdate({ popupHeight: Number(e.target.value) })}
                            className="w-full accent-primary"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
