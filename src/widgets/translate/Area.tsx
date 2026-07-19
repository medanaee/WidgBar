import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRightIcon, CopyIcon, CheckIcon, Loader2Icon, LanguagesIcon } from 'lucide-react';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { useWidgetRegistryStore } from '../../stores/widgetRegistryStore';
import { useTranslation, TranslationKey } from '../../lib/i18n';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { TRANSLATE_LANGUAGES } from './languages';
import { requestTranslate, resolveTranslateConfig } from '../../lib/TranslateCore';
import { useUpdateWidgetConstraints } from '../../stores/widgetConstraintsStore';

export default function TranslateArea({ widgetId }: { widgetId: string }) {
  const config = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
  const updateInstance = useWidgetInstanceStore(state => state.updateInstance);
  const registrySettings = useWidgetRegistryStore(state => state.settings);
  const updateConstraints = useUpdateWidgetConstraints(widgetId);
  const { language, t } = useTranslation();

  const engine = useMemo(
    () => resolveTranslateConfig(widgetId),
    // Recompute when instance override or global registry changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      widgetId,
      config.overrideTranslateDefaults,
      config.useAi,
      config.aiInstanceId,
      config.aiModel,
      config.tone,
      registrySettings['translate'],
    ]
  );

  const sourceLang = (config.sourceLang as string) || 'auto';
  const targetLang = (config.targetLang as string) || (language === 'fa' ? 'fa' : 'en');

  const [input, setInput] = useState((config.lastInput as string) || '');
  const [output, setOutput] = useState((config.lastOutput as string) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    updateConstraints({
      minW: 300,
      minH: 240,
      maxW: 900,
      maxH: 800,
    });
  }, [updateConstraints]);

  const persistLangs = (source: string, target: string) => {
    const current = useWidgetInstanceStore.getState().instances[widgetId] || {};
    updateInstance(widgetId, { ...current, sourceLang: source, targetLang: target });
  };

  const runTranslate = useCallback(
    async (text: string, source: string, target: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setOutput('');
        setError(null);
        return;
      }

      if (source !== 'auto' && source === target) {
        setOutput(trimmed);
        setError(null);
        return;
      }

      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const result = await requestTranslate({
          text: trimmed,
          sourceLang: source,
          targetLang: target,
          widgetId,
        });
        if (reqId !== requestIdRef.current) return;
        setOutput(result);
        updateInstance(widgetId, {
          ...useWidgetInstanceStore.getState().instances[widgetId],
          lastInput: trimmed,
          lastOutput: result,
        });
      } catch (e: any) {
        if (reqId !== requestIdRef.current) return;
        setError(e?.message || String(e));
        setOutput('');
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    },
    [widgetId, updateInstance, engine]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runTranslate(input, sourceLang, targetLang);
    }, 550);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, sourceLang, targetLang, runTranslate]);

  const handleSwap = () => {
    const nextSource = targetLang === 'auto' ? 'en' : targetLang;
    const nextTarget = sourceLang === 'auto' ? (language === 'fa' ? 'fa' : 'en') : sourceLang;
    persistLangs(nextSource, nextTarget);
    setInput(output);
    setOutput(input);
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const targetOptions = TRANSLATE_LANGUAGES.filter(l => l.code !== 'auto');
  const isRtlOut = ['fa', 'ar', 'ur', 'he'].includes(targetLang);
  const isRtlIn = ['fa', 'ar', 'ur', 'he'].includes(sourceLang);
  const dir = language === 'fa' ? 'rtl' : 'ltr';

  return (
    <div className="w-full h-full flex flex-col p-3 gap-2.5 text-zinc-800 dark:text-zinc-100 min-h-0">
      <div className="flex items-center gap-2 shrink-0">
        <Select
          value={sourceLang}
          onValueChange={(val) => persistLangs(val, targetLang)}
        >
          <SelectTrigger
            className="flex-1 h-8 text-xs bg-white/40 dark:bg-zinc-900/30 border-zinc-500/20"
            dir={dir}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir={dir}>
            <SelectGroup>
              {TRANSLATE_LANGUAGES.map(l => (
                <SelectItem key={l.code} value={l.code} className="text-xs">
                  {t(l.nameKey as TranslationKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={handleSwap}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/40 dark:bg-zinc-900/30 border border-zinc-500/20 hover:bg-white/70 dark:hover:bg-zinc-900/50 transition-colors"
          title={t('translateSwap')}
        >
          <ArrowLeftRightIcon className="w-3.5 h-3.5 opacity-80" />
        </button>

        <Select
          value={targetLang}
          onValueChange={(val) => persistLangs(sourceLang, val)}
        >
          <SelectTrigger
            className="flex-1 h-8 text-xs bg-white/40 dark:bg-zinc-900/30 border-zinc-500/20"
            dir={dir}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir={dir}>
            <SelectGroup>
              {targetOptions.map(l => (
                <SelectItem key={l.code} value={l.code} className="text-xs">
                  {t(l.nameKey as TranslationKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex-1 min-h-0 rounded-xl bg-white/40 dark:bg-zinc-900/25 border border-zinc-500/15 overflow-hidden flex flex-col">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('translateInputPlaceholder')}
            dir={isRtlIn || (sourceLang === 'auto' && language === 'fa') ? 'rtl' : 'ltr'}
            className="flex-1 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-zinc-500/70 custom-scrollbar"
          />
        </div>

        <div className="flex-1 min-h-0 rounded-xl bg-white/40 dark:bg-zinc-900/25 border border-zinc-500/15 overflow-hidden flex flex-col relative">
          {loading && (
            <div className="absolute top-2 end-2 z-10">
              <Loader2Icon className="w-3.5 h-3.5 animate-spin text-zinc-500" />
            </div>
          )}
          <textarea
            value={error ? '' : output}
            readOnly
            placeholder={loading ? t('translateTranslating') : t('translateOutputPlaceholder')}
            dir={isRtlOut ? 'rtl' : 'ltr'}
            className="flex-1 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-zinc-500/70 custom-scrollbar"
          />
          {error && (
            <div className="px-3 pb-2 text-[11px] text-red-500 leading-snug">{error}</div>
          )}
          {!!output && !error && (
            <div className="absolute bottom-2 end-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-500/10"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between shrink-0 px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <LanguagesIcon className="w-3 h-3 opacity-70" />
          <span>{engine.useAi ? t('translateViaAi') : t('translateViaGoogle')}</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 px-3 text-xs bg-white/50 dark:bg-zinc-900/40 border border-zinc-500/15"
          disabled={loading || !input.trim()}
          onClick={() => runTranslate(input, sourceLang, targetLang)}
        >
          {t('translateAction')}
        </Button>
      </div>
    </div>
  );
}
