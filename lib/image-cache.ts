/**
 * 图片预加载和缓存策略
 * 用于减少重复的Image Transformations
 */

// 图片缓存Map
const imageCache = new Map<string, boolean>();

/**
 * 预加载图片到浏览器缓存
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) {
      resolve();
      return;
    }

    const img = new Image();
    img.onload = () => {
      imageCache.set(src, true);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 批量预加载图片
 */
export async function preloadImages(srcs: string[]): Promise<void> {
  const promises = srcs.map(src => preloadImage(src).catch(() => {
    // 忽略单个图片加载失败
    console.warn(`Failed to preload image: ${src}`);
  }));
  
  await Promise.all(promises);
}

/**
 * 检查图片是否已缓存
 */
export function isImageCached(src: string): boolean {
  return imageCache.has(src);
}

/**
 * 清理图片缓存
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * 获取缓存统计
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: imageCache.size,
    keys: Array.from(imageCache.keys())
  };
}
