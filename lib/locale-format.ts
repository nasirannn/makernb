const DEFAULT_LOCALE = "en-US";

export const getPreferredLocale = (fallback: string = DEFAULT_LOCALE): string => {
  if (typeof document !== "undefined") {
    const documentLocale = document.documentElement?.lang;
    if (documentLocale) {
      return documentLocale;
    }
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return fallback;
};

export const formatLocalizedNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string
): string => {
  const resolvedLocale = locale || getPreferredLocale();
  return new Intl.NumberFormat(resolvedLocale, options).format(value);
};

export const formatLocalizedDate = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
  locale?: string
): string | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const resolvedLocale = locale || getPreferredLocale();
  return new Intl.DateTimeFormat(resolvedLocale, options).format(date);
};

export const formatIsoDateUTC = (value: string | number | Date): string | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
