import React, { Suspense } from 'react';
import { DesktopWidget, BarWidget } from '../types/layout';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useTranslation } from '../lib/i18n';

interface Props {
  widget: DesktopWidget | BarWidget;
  context: 'Bar' | 'Area';
  onBack: () => void;
}

export default function WidgetSettingsPanel({ widget, context, onBack }: Props) {
  const { t, language } = useTranslation();
  const [tabs, setTabs] = React.useState<{
    general: React.ComponentType<{ widgetId: string }> | null;
    widget: React.ComponentType<{ widgetId: string }> | null;
    bar: React.ComponentType<{ widgetId: string }> | null;
  }>({ general: null, widget: null, bar: null });
  const [activeTab, setActiveTab] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadTabs = async () => {
      setLoading(true);
      const loadedTabs: any = { general: null, widget: null, bar: null };
      
      try {
        const module = await import(`../widgets/${widget.type}/GeneralSetting.tsx`);
        loadedTabs.general = module.default;
      } catch (e) {}

      try {
        const module = await import(`../widgets/${widget.type}/WidgetSetting.tsx`);
        loadedTabs.widget = module.default;
      } catch (e) {}

      if (context === 'Bar') {
        try {
          const module = await import(`../widgets/${widget.type}/BarSetting.tsx`);
          loadedTabs.bar = module.default;
        } catch (e) {}
      }

      setTabs(loadedTabs);
      
      if (loadedTabs.general) {
        setActiveTab('general');
      } else if (loadedTabs.widget) {
        setActiveTab('widget');
      } else if (loadedTabs.bar) {
        setActiveTab('bar');
      }
      setLoading(false);
    };

    loadTabs();
  }, [widget.type, context]);

  const hasAnyTab = tabs.general || tabs.widget || tabs.bar;

  return (
    <div className="w-full flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-500/10 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 capitalize">
            {widget.type} Settings
          </h2>
          <p className="text-xs text-zinc-500">Configure settings for this specific widget instance</p>
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="text-zinc-500 text-sm mt-4">Loading settings...</div>
        ) : !hasAnyTab ? (
          <div className="flex items-center justify-center h-48 border border-dashed border-zinc-500/30 rounded-xl mt-4">
            <span className="text-sm text-zinc-500">No specific settings for this widget.</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0" dir={language === 'fa' ? 'rtl' : 'ltr'}>
            <TabsList className="mb-4 h-8 bg-zinc-500/10 dark:bg-zinc-500/20 w-full flex">
              {tabs.general && (
                <TabsTrigger value="general" className="text-xs px-4 flex-1">
                  {t("general")}
                </TabsTrigger>
              )}
              {tabs.widget && (
                <TabsTrigger value="widget" className="text-xs px-4 flex-1">
                  {t("widgets")}
                </TabsTrigger>
              )}
              {tabs.bar && (
                <TabsTrigger value="bar" className="text-xs px-4 flex-1">
                  {t("bar")}
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
              <Suspense fallback={<div className="text-zinc-500 text-sm mt-4">Loading tab content...</div>}>
                {tabs.general && activeTab === 'general' && (
                  <tabs.general widgetId={widget.id} />
                )}
                {tabs.widget && activeTab === 'widget' && (
                  <tabs.widget widgetId={widget.id} />
                )}
                {tabs.bar && activeTab === 'bar' && (
                  <tabs.bar widgetId={widget.id} />
                )}
              </Suspense>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
