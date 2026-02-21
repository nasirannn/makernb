export const SUPPORTED_LOCALES = ["en", "zh-CN", "ja"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
