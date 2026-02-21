"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_LOCALE,
  getCachedMessages,
  loadMessages,
  SUPPORTED_LOCALES,
  type AppLocale,
  type MessageDictionary,
} from "@/lib/i18n/messages";
import {
  LOCALE_COOKIE_KEY,
  getLocaleFromPathname,
  normalizeLocale,
  replaceLocaleInPathname,
} from "@/lib/i18n/routing";

const LOCALE_STORAGE_KEY = LOCALE_COOKIE_KEY;

type TranslationVars = Record<string, string | number | null | undefined>;

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, vars?: TranslationVars) => string;
}

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

function getMessage(dictionary: MessageDictionary | undefined, key: string): string | undefined {
  if (!dictionary) {
    return undefined;
  }

  const path = key.split(".");
  let current: unknown = dictionary;

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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fallbackLocale, setFallbackLocale] = React.useState<AppLocale>(DEFAULT_LOCALE);
  const [messagesByLocale, setMessagesByLocale] = React.useState<Partial<Record<AppLocale, MessageDictionary>>>(() => {
    const initialDefaultMessages = getCachedMessages(DEFAULT_LOCALE);
    return initialDefaultMessages ? { [DEFAULT_LOCALE]: initialDefaultMessages } : {};
  });
  const routeLocale = React.useMemo(() => getLocaleFromPathname(pathname), [pathname]);
  const locale = routeLocale ?? fallbackLocale;

  const persistLocale = React.useCallback((nextLocale: AppLocale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // ignore localStorage write errors
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = nextLocale;
      document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);

  React.useEffect(() => {
    if (routeLocale) {
      setFallbackLocale(routeLocale);
      return;
    }

    const storedLocale = (() => {
      try {
        return window.localStorage.getItem(LOCALE_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    const nextLocale = normalizeLocale(storedLocale || DEFAULT_LOCALE);
    setFallbackLocale(nextLocale);
  }, [routeLocale]);

  React.useEffect(() => {
    persistLocale(locale);
  }, [locale, persistLocale]);

  React.useEffect(() => {
    let cancelled = false;

    const localesToLoad = Array.from(new Set<AppLocale>([DEFAULT_LOCALE, locale]));

    void Promise.all(
      localesToLoad.map(async (targetLocale) => {
        const dictionary = await loadMessages(targetLocale);
        return [targetLocale, dictionary] as const;
      })
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setMessagesByLocale((current) => {
          let changed = false;
          const next = { ...current };

          for (const [targetLocale, dictionary] of entries) {
            if (next[targetLocale] === dictionary) {
              continue;
            }
            changed = true;
            next[targetLocale] = dictionary;
          }

          return changed ? next : current;
        });
      })
      .catch((error) => {
        console.error("[I18N] Failed to load message dictionaries:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = React.useCallback(
    (nextLocale: AppLocale) => {
      if (!SUPPORTED_LOCALES.includes(nextLocale)) {
        return;
      }

      if (nextLocale === locale) {
        return;
      }

      setFallbackLocale(nextLocale);
      persistLocale(nextLocale);

      const currentPath = pathname ?? "/";
      const nextPath = replaceLocaleInPathname(currentPath, nextLocale);
      const query = searchParams?.toString();
      const currentHref = query ? `${currentPath}?${query}` : currentPath;
      const nextHref = query ? `${nextPath}?${query}` : nextPath;

      if (nextHref !== currentHref) {
        router.push(nextHref);
      }
    },
    [locale, pathname, persistLocale, router, searchParams]
  );

  const t = React.useCallback(
    (key: string, vars?: TranslationVars) => {
      const resolved =
        getMessage(messagesByLocale[locale], key) ??
        getMessage(messagesByLocale[DEFAULT_LOCALE], key) ??
        key;
      return formatMessage(resolved, vars);
    },
    [locale, messagesByLocale]
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
