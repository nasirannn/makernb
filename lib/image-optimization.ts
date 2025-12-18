/**
 * Image Optimization Utilities
 *
 * Provides functions for optimizing images before uploading to R2 storage.
 * Uses sharp library for high-performance image processing.
 */

// Dynamic import to avoid build-time issues
let sharp: any;

async function getSharp() {
  if (!sharp) {
    sharp = (await import('sharp')).default;
  }
  return sharp;
}

/**
 * Image optimization configuration
 */
const IMAGE_CONFIG = {
  thumbnail: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 85,
    format: 'webp' as const,
  },
  original: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 95,
    format: 'png' as const,
  },
};

/**
 * Compress and optimize image for thumbnail/display
 * Converts to WebP format with optimized size
 *
 * @param buffer - Original image buffer
 * @returns Optimized image buffer and metadata
 */
export async function compressImageForThumbnail(buffer: Buffer): Promise<{
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
}> {
  try {
    const sharp = await getSharp();
    const sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();

    const optimizedBuffer = await sharpInstance
      .resize(IMAGE_CONFIG.thumbnail.maxWidth, IMAGE_CONFIG.thumbnail.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: IMAGE_CONFIG.thumbnail.quality,
        effort: 6, // Higher effort = better compression (0-6)
      })
      .toBuffer();

    const sharpForMetadata = await getSharp();
    const optimizedMetadata = await sharpForMetadata(optimizedBuffer).metadata();

    console.log('[Image Optimization] Thumbnail created:', {
      originalSize: `${(buffer.length / 1024).toFixed(2)}KB`,
      optimizedSize: `${(optimizedBuffer.length / 1024).toFixed(2)}KB`,
      reduction: `${(((buffer.length - optimizedBuffer.length) / buffer.length) * 100).toFixed(1)}%`,
      dimensions: `${optimizedMetadata.width}x${optimizedMetadata.height}`,
    });

    return {
      buffer: optimizedBuffer,
      format: 'webp',
      width: optimizedMetadata.width || 0,
      height: optimizedMetadata.height || 0,
      size: optimizedBuffer.length,
    };
  } catch (error) {
    console.error('[Image Optimization] Thumbnail compression failed:', error);
    throw new Error('Failed to compress image for thumbnail');
  }
}

/**
 * Optimize original image while maintaining high quality
 * Keeps PNG format but optimizes size
 *
 * @param buffer - Original image buffer
 * @returns Optimized image buffer and metadata
 */
export async function optimizeOriginalImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
}> {
  try {
    const sharp = await getSharp();
    const sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();

    // If image is already small and reasonable format, return as-is
    if (buffer.length < 500 * 1024 && metadata.format === 'png') {
      console.log('[Image Optimization] Original image is already optimized, skipping');
      return {
        buffer,
        format: metadata.format || 'png',
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: buffer.length,
      };
    }

    const optimizedBuffer = await sharpInstance
      .resize(IMAGE_CONFIG.original.maxWidth, IMAGE_CONFIG.original.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({
        quality: IMAGE_CONFIG.original.quality,
        compressionLevel: 9, // Max compression (0-9)
        palette: true, // Use palette-based encoding if beneficial
      })
      .toBuffer();

    const sharpForMetadata = await getSharp();
    const optimizedMetadata = await sharpForMetadata(optimizedBuffer).metadata();

    console.log('[Image Optimization] Original image optimized:', {
      originalSize: `${(buffer.length / 1024).toFixed(2)}KB`,
      optimizedSize: `${(optimizedBuffer.length / 1024).toFixed(2)}KB`,
      reduction: `${(((buffer.length - optimizedBuffer.length) / buffer.length) * 100).toFixed(1)}%`,
      dimensions: `${optimizedMetadata.width}x${optimizedMetadata.height}`,
    });

    return {
      buffer: optimizedBuffer,
      format: 'png',
      width: optimizedMetadata.width || 0,
      height: optimizedMetadata.height || 0,
      size: optimizedBuffer.length,
    };
  } catch (error) {
    console.error('[Image Optimization] Original image optimization failed:', error);
    // If optimization fails, return original buffer
    const sharpFallback = await getSharp();
    const metadata = await sharpFallback(buffer).metadata();
    return {
      buffer,
      format: metadata.format || 'png',
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: buffer.length,
    };
  }
}

/**
 * Generate filename with proper extension based on format
 */
export function getOptimizedFilename(originalFilename: string, format: 'webp' | 'png', prefix?: string): string {
  const baseName = originalFilename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  const prefixStr = prefix ? `${prefix}_` : '';
  return `${prefixStr}${baseName}.${format}`;
}
