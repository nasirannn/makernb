import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";
import { enMessages } from "@/lib/i18n/dictionaries/en";

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale };

type MessageNode = string | MessageDictionary;
export type MessageDictionary = {
  [key: string]: MessageNode;
};
export type Messages = Record<AppLocale, MessageDictionary>;

type MessageLoader = () => Promise<MessageDictionary>;

const messageLoaders: Record<AppLocale, MessageLoader> = {
  en: async () => enMessages,
  ja: async () => (await import("@/lib/i18n/dictionaries/ja")).jaMessages,
  "zh-CN": async () => (await import("@/lib/i18n/dictionaries/zh-cn")).zhCNMessages,
};

const messageCache: Partial<Record<AppLocale, MessageDictionary>> = {
  en: enMessages,
};

export async function loadMessages(locale: AppLocale): Promise<MessageDictionary> {
  const cached = messageCache[locale];
  if (cached) {
    return cached;
  }

  const loader = messageLoaders[locale];
  const dictionary = await loader();
  messageCache[locale] = dictionary;
  return dictionary;
}

export function getCachedMessages(locale: AppLocale): MessageDictionary | null {
  return messageCache[locale] ?? null;
}
