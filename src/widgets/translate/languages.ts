export type TranslateTone = 'default' | 'formal' | 'casual' | 'literary' | 'technical' | 'friendly';

export interface LangOption {
  code: string;
  /** Stable English name for AI system prompts */
  nameEn: string;
  /** i18n key for UI */
  nameKey:
    | 'langAuto'
    | 'langEn'
    | 'langFa'
    | 'langAr'
    | 'langTr'
    | 'langDe'
    | 'langFr'
    | 'langEs'
    | 'langIt'
    | 'langRu'
    | 'langZh'
    | 'langJa'
    | 'langKo'
    | 'langPt'
    | 'langHi'
    | 'langNl'
    | 'langPl'
    | 'langUk'
    | 'langSv'
    | 'langId';
}

export const TRANSLATE_LANGUAGES: LangOption[] = [
  { code: 'auto', nameEn: 'auto-detect', nameKey: 'langAuto' },
  { code: 'en', nameEn: 'English', nameKey: 'langEn' },
  { code: 'fa', nameEn: 'Persian', nameKey: 'langFa' },
  { code: 'ar', nameEn: 'Arabic', nameKey: 'langAr' },
  { code: 'tr', nameEn: 'Turkish', nameKey: 'langTr' },
  { code: 'de', nameEn: 'German', nameKey: 'langDe' },
  { code: 'fr', nameEn: 'French', nameKey: 'langFr' },
  { code: 'es', nameEn: 'Spanish', nameKey: 'langEs' },
  { code: 'it', nameEn: 'Italian', nameKey: 'langIt' },
  { code: 'ru', nameEn: 'Russian', nameKey: 'langRu' },
  { code: 'zh', nameEn: 'Chinese', nameKey: 'langZh' },
  { code: 'ja', nameEn: 'Japanese', nameKey: 'langJa' },
  { code: 'ko', nameEn: 'Korean', nameKey: 'langKo' },
  { code: 'pt', nameEn: 'Portuguese', nameKey: 'langPt' },
  { code: 'hi', nameEn: 'Hindi', nameKey: 'langHi' },
  { code: 'nl', nameEn: 'Dutch', nameKey: 'langNl' },
  { code: 'pl', nameEn: 'Polish', nameKey: 'langPl' },
  { code: 'uk', nameEn: 'Ukrainian', nameKey: 'langUk' },
  { code: 'sv', nameEn: 'Swedish', nameKey: 'langSv' },
  { code: 'id', nameEn: 'Indonesian', nameKey: 'langId' },
];

export const TRANSLATE_TONES: {
  id: TranslateTone;
  nameKey:
    | 'translateToneDefault'
    | 'translateToneFormal'
    | 'translateToneCasual'
    | 'translateToneLiterary'
    | 'translateToneTechnical'
    | 'translateToneFriendly';
}[] = [
  { id: 'default', nameKey: 'translateToneDefault' },
  { id: 'formal', nameKey: 'translateToneFormal' },
  { id: 'casual', nameKey: 'translateToneCasual' },
  { id: 'literary', nameKey: 'translateToneLiterary' },
  { id: 'technical', nameKey: 'translateToneTechnical' },
  { id: 'friendly', nameKey: 'translateToneFriendly' },
];

export function langNameEn(code: string): string {
  return TRANSLATE_LANGUAGES.find(l => l.code === code)?.nameEn || code;
}
