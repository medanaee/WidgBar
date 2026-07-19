import { useEffect, useState } from 'react';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { Switch } from '../../components/ui/switch';
import { SettingCard, SettingCardNoLayout } from '../../components/ui/SettingCard';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useTranslation, TranslationKey } from '../../lib/i18n';
import { TRANSLATE_TONES, TranslateTone } from './languages';
import { fetchModelsForInstance } from './fetchModels';
import { Loader2Icon } from 'lucide-react';
import { AI_PROVIDERS } from '../../types/ai';
import { TranslateEngineConfig } from '../../lib/TranslateCore';

interface Props {
  value: TranslateEngineConfig;
  onChange: (updates: Partial<TranslateEngineConfig>) => void;
}

export default function TranslateEngineSettingsFields({ value, onChange }: Props) {
  const instances = useAiServicesStore(state => state.data.instances);
  const { t, language } = useTranslation();
  const dir = language === 'fa' ? 'rtl' : 'ltr';

  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!value.useAi || !value.aiInstanceId) {
      setModels([]);
      return;
    }

    const instance = instances.find(i => i.id === value.aiInstanceId);
    if (!instance) {
      setModels([]);
      return;
    }

    let cancelled = false;
    setLoadingModels(true);
    fetchModelsForInstance(instance)
      .then(list => {
        if (cancelled) return;
        setModels(list);
        if (list.length > 0 && (!value.aiModel || !list.includes(value.aiModel))) {
          onChange({ aiModel: list[0] });
        }
      })
      .catch(err => {
        console.error('Failed to fetch models for translate engine:', err);
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.useAi, value.aiInstanceId, instances]);

  const selectedInstance = instances.find(i => i.id === value.aiInstanceId);
  const providerName = selectedInstance
    ? AI_PROVIDERS.find(p => p.id === selectedInstance.providerId)?.name
    : undefined;

  return (
    <div className="space-y-3">
      <SettingCard>
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {t('translateUseAi')}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t('translateUseAiDesc')}
          </p>
        </div>
        <Switch
          checked={value.useAi}
          onCheckedChange={(checked) => onChange({ useAi: checked })}
        />
      </SettingCard>

      {value.useAi && (
        <>
          <SettingCardNoLayout className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t('translateAiService')}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t('translateAiServiceDesc')}
              </p>
            </div>

            {instances.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('translateNoAiServices')}
              </p>
            ) : (
              <Select
                value={value.aiInstanceId || ''}
                onValueChange={(val) => onChange({ aiInstanceId: val, aiModel: undefined })}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-transparent" dir={dir}>
                  <SelectValue placeholder={t('translateSelectService')} />
                </SelectTrigger>
                <SelectContent dir={dir}>
                  <SelectGroup>
                    {instances.map(inst => {
                      const provider = AI_PROVIDERS.find(p => p.id === inst.providerId)?.name || inst.providerId;
                      return (
                        <SelectItem key={inst.id} value={inst.id} className="text-xs">
                          {inst.name} · {provider}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}

            {selectedInstance && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('translateModel')}
                  </h3>
                  {providerName && (
                    <span className="text-[10px] text-zinc-500 truncate">{providerName}</span>
                  )}
                </div>
                {loadingModels ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 py-1">
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                    {t('translateFetchingModels')}
                  </div>
                ) : models.length > 0 ? (
                  <Select
                    value={value.aiModel || models[0]}
                    onValueChange={(val) => onChange({ aiModel: val })}
                  >
                    <SelectTrigger className="w-full h-8 text-xs bg-transparent" dir="ltr">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {models.map(m => (
                          <SelectItem key={m} value={m} className="text-xs font-mono">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-zinc-500">{t('translateNoModels')}</p>
                )}
              </div>
            )}
          </SettingCardNoLayout>

          <SettingCard>
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t('translateTone')}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('translateToneDesc')}
              </p>
            </div>
            <Select
              value={value.tone}
              onValueChange={(val) => onChange({ tone: val as TranslateTone })}
            >
              <SelectTrigger className="w-36 h-8 text-xs bg-transparent" dir={dir}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir={dir}>
                <SelectGroup>
                  {TRANSLATE_TONES.map(tone => (
                    <SelectItem key={tone.id} value={tone.id} className="text-xs">
                      {t(tone.nameKey as TranslationKey)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingCard>
        </>
      )}
    </div>
  );
}
