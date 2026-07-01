import { useSettingsStore } from '../stores/settingsStore';

export const translations = {
  en: {
    home: "Home",
    settings: "Settings",
    monitors: "Monitors",
    general: "General",
    bar: "Bar",
    widgets: "Widgets",
    welcome: "Welcome. Select an option from the sidebar.",
    darkMode: "Dark Mode",
    darkModeDesc: "Toggle between dark and light theme.",
    language: "Language",
    languageDesc: "Select the display language.",
    barHeight: "Bar Height",
    barHeightDesc: "Global height for all bars.",
    widgetsSettingsComingSoon: "Widgets settings coming soon.",
    primary: "Primary",
    enableBar: "Enable Bar",
    enableBarDesc: "Show bar on this monitor.",
    enableWidgetArea: "Enable Widget Area",
    enableWidgetAreaDesc: "Allow widgets on this monitor.",
    medium: "Medium",
    large: "Large",
    monitorPrefix: "Monitor",
  },
  fa: {
    home: "خانه",
    settings: "تنظیمات",
    monitors: "مانیتورها",
    general: "عمومی",
    bar: "نوار",
    widgets: "ویجت‌ها",
    welcome: "خوش آمدید. یک گزینه از نوار کناری انتخاب کنید.",
    darkMode: "حالت تاریک",
    darkModeDesc: "تغییر بین حالت تاریک و روشن.",
    language: "زبان",
    languageDesc: "انتخاب زبان نمایش برنامه.",
    barHeight: "ارتفاع نوار",
    barHeightDesc: "ارتفاع سراسری برای تمام نوارها.",
    widgetsSettingsComingSoon: "تنظیمات ویجت‌ها به زودی اضافه می‌شود.",
    primary: "اصلی",
    enableBar: "فعال‌سازی نوار",
    enableBarDesc: "نمایش نوار در این مانیتور.",
    enableWidgetArea: "فعال‌سازی ناحیه ویجت",
    enableWidgetAreaDesc: "اجازه استفاده از ویجت در این مانیتور.",
    medium: "متوسط",
    large: "بزرگ",
    monitorPrefix: "مانیتور",
  }
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export function useTranslation() {
  const language = useSettingsStore(state => state.settings.language) as Language;
  
  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  return { t, language };
}
