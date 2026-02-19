"use client";

import React from "react";
import { DEFAULT_LOCALE, messages, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/messages";

const LOCALE_STORAGE_KEY = "makernb.locale";

type TranslationVars = Record<string, string | number | null | undefined>;

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, vars?: TranslationVars) => string;
}

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (!locale) return DEFAULT_LOCALE;
  const normalized = locale.toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return DEFAULT_LOCALE;
}

function getMessage(locale: AppLocale, key: string): string | undefined {
  const path = key.split(".");
  let current: unknown = messages[locale];

  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function formatMessage(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    const storedLocale = (() => {
      try {
        return window.localStorage.getItem(LOCALE_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    const browserLocale = typeof navigator !== "undefined" ? navigator.language : undefined;
    const nextLocale = normalizeLocale(storedLocale || browserLocale);
    setLocaleState(nextLocale);
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore localStorage write errors
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = React.useCallback((nextLocale: AppLocale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) {
      return;
    }
    setLocaleState(nextLocale);
  }, []);

  const t = React.useCallback(
    (key: string, vars?: TranslationVars) => {
      const resolved = getMessage(locale, key) ?? getMessage(DEFAULT_LOCALE, key) ?? key;
      return formatMessage(resolved, vars);
    },
    [locale]
  );

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
