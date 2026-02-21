import type { AppLocale } from '@/lib/i18n/config';

export const BLOG_CATEGORY_KEYS = ['music_history', 'artist_spotlight'] as const;

export type BlogCategoryKey = (typeof BLOG_CATEGORY_KEYS)[number];

const BLOG_CATEGORY_LABELS: Record<BlogCategoryKey, Record<AppLocale, string>> = {
  music_history: {
    en: 'Music History',
    'zh-CN': '音乐历史',
    ja: '音楽史',
  },
  artist_spotlight: {
    en: 'Artist Spotlight',
    'zh-CN': '人物聚焦',
    ja: 'アーティスト特集',
  },
};

const CATEGORY_ALIAS_TO_KEY: Record<string, BlogCategoryKey> = {
  music_history: 'music_history',
  'Music History': 'music_history',
  音乐历史: 'music_history',
  音楽史: 'music_history',
  artist_spotlight: 'artist_spotlight',
  'Artist Spotlight': 'artist_spotlight',
  人物聚焦: 'artist_spotlight',
  アーティスト特集: 'artist_spotlight',
};

export function normalizeBlogCategoryKey(value: string | null | undefined): BlogCategoryKey | null {
  if (!value) return null;
  return CATEGORY_ALIAS_TO_KEY[value] ?? null;
}

export function getBlogCategoryLabel(categoryKey: BlogCategoryKey, locale: AppLocale): string {
  return BLOG_CATEGORY_LABELS[categoryKey][locale];
}
