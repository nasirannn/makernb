import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'content/posts');

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  tags: string[];
  image: string;
  featured?: boolean;
  content: string;
}

// 计算阅读时间
function calculateReadTime(content: string): string {
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
  
  return `${totalMinutes} min read`;
}

export function getAllPosts(): BlogPost[] {
  const fileNames = fs.readdirSync(postsDirectory);
  
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.mdx'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);

      return {
        slug,
        content,
        readTime: calculateReadTime(content), // 自动计算阅读时间
        ...data,
      } as BlogPost;
    });

  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.mdx`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      slug,
      content,
      readTime: calculateReadTime(content), // 自动计算阅读时间
      ...data,
    } as BlogPost;
  } catch (error) {
    return null;
  }
}

export function getPostsByCategory(category: string): BlogPost[] {
  const allPosts = getAllPosts();
  if (category === '全部') return allPosts;
  return allPosts.filter(post => post.category === category);
}

export function getFeaturedPosts(): BlogPost[] {
  const allPosts = getAllPosts();
  return allPosts.filter(post => post.featured);
}

export function getAllCategories(): string[] {
  const allPosts = getAllPosts();
  const categories = new Set(allPosts.map(post => post.category));
  return ['全部', ...Array.from(categories)];
}

export function getAllTags(): string[] {
  const allPosts = getAllPosts();
  const tags = new Set(allPosts.flatMap(post => post.tags));
  return Array.from(tags);
}
