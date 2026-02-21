import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { DEFAULT_LOCALE, type AppLocale } from '@/lib/i18n/config';
import {
  type BlogCategoryKey,
  getBlogCategoryLabel,
  normalizeBlogCategoryKey,
} from '@/lib/blog-config';

const postsRootDirectory = path.join(process.cwd(), 'content/posts');

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  categoryKey: BlogCategoryKey;
  category: string;
  tags: string[];
  image: string;
  featured?: boolean;
  content: string;
}

interface PostQueryOptions {
  fallbackToDefault?: boolean;
}

function formatReadTime(minutes: number, locale: AppLocale): string {
  switch (locale) {
    case 'zh-CN':
      return `${minutes} 分钟阅读`;
    case 'ja':
      return `${minutes} 分で読了`;
    case 'en':
    default:
      return `${minutes} min read`;
  }
}

function getLocalePostsDirectory(locale: AppLocale): string {
  return path.join(postsRootDirectory, locale);
}

function directoryExists(directory: string): boolean {
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function getPostFileNamesFromDirectory(directory: string): string[] {
  if (!directoryExists(directory)) {
    return [];
  }

  return fs.readdirSync(directory).filter((fileName) => fileName.endsWith('.mdx'));
}

function toTimestamp(dateValue: string): number {
  const timestamp = Date.parse(dateValue);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortPostsByDateDesc(posts: BlogPost[]): BlogPost[] {
  return posts.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
}

function getDirectoriesForLocale(locale: AppLocale, fallbackToDefault: boolean): string[] {
  const directories: string[] = [];

  directories.push(getLocalePostsDirectory(locale));

  if (locale === DEFAULT_LOCALE) {
    directories.push(postsRootDirectory);
    return Array.from(new Set(directories));
  }

  if (fallbackToDefault) {
    directories.push(getLocalePostsDirectory(DEFAULT_LOCALE));
    directories.push(postsRootDirectory);
  }

  return Array.from(new Set(directories));
}

function parsePostFile(fullPath: string, slug: string, locale: AppLocale): BlogPost {
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  const frontmatter = data as Record<string, unknown>;
  const rawCategory = typeof frontmatter.category === 'string' ? frontmatter.category : '';
  const rawCategoryKey = typeof frontmatter.categoryKey === 'string' ? frontmatter.categoryKey : '';
  const categoryKey = normalizeBlogCategoryKey(rawCategoryKey || rawCategory) ?? 'music_history';
  const localizedCategory = getBlogCategoryLabel(categoryKey, locale);

  return {
    slug,
    content,
    readTime: calculateReadTime(content, locale),
    ...frontmatter,
    categoryKey,
    category: localizedCategory,
  } as BlogPost;
}

function readPostsFromDirectory(directory: string, locale: AppLocale): BlogPost[] {
  return getPostFileNamesFromDirectory(directory).map((fileName) => {
    const slug = fileName.replace(/\.mdx$/, '');
    const fullPath = path.join(directory, fileName);
    return parsePostFile(fullPath, slug, locale);
  });
}

function readPostFromDirectory(directory: string, slug: string, locale: AppLocale): BlogPost | null {
  const fullPath = path.join(directory, `${slug}.mdx`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return parsePostFile(fullPath, slug, locale);
}

// 计算阅读时间
function calculateReadTime(content: string, locale: AppLocale): string {
  // 移除Markdown语法，只计算纯文本
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // 移除标题标记
    .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
    .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接，保留文本
    .replace(/`(.*?)`/g, '$1') // 移除代码标记
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/^\s*[-*+]\s+/gm, '') // 移除列表标记
    .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表标记
    .replace(/\n+/g, ' ') // 将换行符替换为空格
    .trim();

  // 计算字数（中文字符和英文单词）
  const chineseChars = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = plainText.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(word => word.length > 0).length;
  
  // 计算阅读时间
  const chineseReadTime = chineseChars / 400; // 中文400字/分钟
  const englishReadTime = englishWords / 200; // 英文200词/分钟
  const totalMinutes = Math.ceil(chineseReadTime + englishReadTime);

  return formatReadTime(totalMinutes, locale);
}

export function getAllPosts(locale: AppLocale = DEFAULT_LOCALE, options: PostQueryOptions = {}): BlogPost[] {
  const fallbackToDefault = options.fallbackToDefault ?? true;
  const directories = getDirectoriesForLocale(locale, fallbackToDefault);
  const postsBySlug = new Map<string, BlogPost>();

  for (const directory of directories) {
    const posts = readPostsFromDirectory(directory, locale);
    for (const post of posts) {
      if (!postsBySlug.has(post.slug)) {
        postsBySlug.set(post.slug, post);
      }
    }
  }

  return sortPostsByDateDesc(Array.from(postsBySlug.values()));
}

export function getPostBySlug(
  slug: string,
  locale: AppLocale = DEFAULT_LOCALE,
  options: PostQueryOptions = {}
): BlogPost | null {
  const fallbackToDefault = options.fallbackToDefault ?? true;
  const directories = getDirectoriesForLocale(locale, fallbackToDefault);

  for (const directory of directories) {
    const post = readPostFromDirectory(directory, slug, locale);
    if (post) {
      return post;
    }
  }

  return null;
}

export function getPostsByCategory(category: string, locale: AppLocale = DEFAULT_LOCALE): BlogPost[] {
  const allPosts = getAllPosts(locale);
  if (category === 'all' || category === '全部') return allPosts;
  const categoryKey = normalizeBlogCategoryKey(category);
  if (categoryKey) {
    return allPosts.filter((post) => post.categoryKey === categoryKey);
  }
  return allPosts.filter((post) => post.category === category);
}

export function getFeaturedPosts(locale: AppLocale = DEFAULT_LOCALE): BlogPost[] {
  const allPosts = getAllPosts(locale);
  return allPosts.filter(post => post.featured);
}

export function getAllCategories(locale: AppLocale = DEFAULT_LOCALE): string[] {
  const allPosts = getAllPosts(locale);
  const categories = new Set(allPosts.map(post => post.category));
  return ['全部', ...Array.from(categories)];
}

export function getAllTags(locale: AppLocale = DEFAULT_LOCALE): string[] {
  const allPosts = getAllPosts(locale);
  const tags = new Set(allPosts.flatMap(post => post.tags));
  return Array.from(tags);
}
