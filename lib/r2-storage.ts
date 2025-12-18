import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { compressImageForThumbnail, optimizeOriginalImage, getOptimizedFilename } from './image-optimization';

// R2客户端配置（延迟初始化）
let _r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!_r2Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are not set. Please check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.');
    }
    
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return _r2Client;
}

// 导出客户端（保持向后兼容，但延迟初始化）
export const r2Client = new Proxy({} as S3Client, {
  get(target, prop) {
    return getR2Client()[prop as keyof S3Client];
  }
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || '';

/**
 * 从URL下载文件（带重试机制）
 */
export async function downloadFromUrl(url: string, maxRetries = 5): Promise<Buffer> {
  let lastError: Error | null = null;
  
  // 验证URL（只验证一次）
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('Invalid URL: URL is empty or undefined');
  }
  
  try {
    new URL(url);
  } catch (urlError) {
    throw new Error(`Invalid URL format: ${url}`);
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Download] Attempt ${attempt}/${maxRetries} for ${url.substring(0, 100)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 增加到45秒
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MakerNB/1.0)',
          'Accept': '*/*',
          'Connection': 'keep-alive',
        },
        redirect: 'follow',
        keepalive: true,
        // 禁用缓存，避免 Next.js 尝试缓存超过 2MB 的文件
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        console.error(`[Download] Failed with ${errorMsg}`);
        throw new Error(`Failed to download file: ${errorMsg}`);
      }
      
      // 检查content-length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) === 0) {
        throw new Error('File is empty (content-length: 0)');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // 验证下载的数据不为空
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      console.log(`[Download] Success on attempt ${attempt}/${maxRetries}, size: ${arrayBuffer.byteLength} bytes`);
      
      return Buffer.from(arrayBuffer);
    } catch (error) {
      lastError = error as Error;
      const errorName = lastError.name || 'Error';
      const errorMsg = lastError.message || 'Unknown error';
      
      console.error(`[Download] Attempt ${attempt}/${maxRetries} failed:`, {
        name: errorName,
        message: errorMsg,
        code: (error as any).code,
        cause: (error as any).cause?.message,
      });
      
      // 对于某些错误类型，立即失败不重试
      if (errorMsg.includes('Invalid URL') || errorMsg.includes('HTTP 404') || errorMsg.includes('HTTP 403')) {
        console.error(`[Download] Fatal error, not retrying: ${errorMsg}`);
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        // 指数退避：3s, 6s, 12s, 20s
        const delayMs = Math.min(3000 * Math.pow(2, attempt - 1), 20000);
        console.log(`[Download] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.error(`[Download] Failed after ${maxRetries} attempts, giving up`);
  throw lastError || new Error('Download failed after all retries');
}

/**
 * 从URL下载文件，返回buffer与响应的Content-Type等元信息（带重试）
 */
export async function downloadFromUrlWithMeta(
  url: string,
  maxRetries = 5
): Promise<{ buffer: Buffer; contentType: string | null; filenameFromUrl: string | null }> {
  let lastError: Error | null = null;
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('Invalid URL: URL is empty or undefined');
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MakerNB/1.0)',
          'Accept': '*/*',
          'Connection': 'keep-alive',
        },
        redirect: 'follow',
        keepalive: true,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded file is empty');
      }
      const contentType = response.headers.get('content-type');
      let filenameFromUrl: string | null = null;
      try {
        const u = new URL(url);
        filenameFromUrl = (u.pathname.split('/').pop() || '') || null;
      } catch {
        filenameFromUrl = null;
      }
      return { buffer: Buffer.from(arrayBuffer), contentType, filenameFromUrl };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delayMs = Math.min(3000 * Math.pow(2, attempt - 1), 20000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError || new Error('Download failed after all retries');
}

/**
 * 上传音频文件到R2
 */
export async function uploadAudioFile(
  buffer: Buffer,
  taskId: string,
  filename: string,
  userId: string
): Promise<string> {
  try {
    const key = `audio/${userId}/${taskId}/${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'audio/mpeg',
      Metadata: {
        taskId,
        userId,
        type: 'audio'
      }
    });

    await getR2Client().send(command);
    
    // 返回公开访问URL
    const publicUrl = `${PUBLIC_DOMAIN}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading audio file:', error);
    throw error;
  }
}

/**
 * 上传WAV文件到R2
 */
export async function uploadWavFile(
  buffer: Buffer,
  taskId: string,
  filename: string,
  userId: string
): Promise<string> {
  try {
    const bucketName = process.env.R2_BUCKET_NAME || BUCKET_NAME;
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || PUBLIC_DOMAIN;
    
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME is not set');
    }
    
    if (!publicDomain) {
      throw new Error('R2_PUBLIC_DOMAIN is not set');
    }
    
    const key = `wav/${userId}/${taskId}/${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'audio/wav',
      Metadata: {
        taskId,
        userId,
        type: 'wav'
      }
    });

    await getR2Client().send(command);
    
    // 返回公开访问URL
    const publicUrl = `${publicDomain}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading WAV file:', error);
    throw error;
  }
}

/**
 * 上传封面图片到R2（双版本：原图 + 缩略图）
 *
 * @param buffer - Original image buffer
 * @param taskId - Task ID
 * @param filename - Original filename
 * @param userId - User ID
 * @param contentType - Optional content type
 * @returns Object containing thumbnail URL (for display) and original URL (for download)
 */
export async function uploadCoverImageWithVersions(
  buffer: Buffer,
  taskId: string,
  filename: string,
  userId: string,
  contentType?: string | null
): Promise<{ thumbnailUrl: string; originalUrl: string }> {
  try {
    console.log('[R2 Upload] Starting dual-version cover upload:', {
      taskId,
      userId,
      originalSize: `${(buffer.length / 1024).toFixed(2)}KB`,
    });

    // 1. Optimize and upload thumbnail (WebP, 800px, for display)
    const thumbnailData = await compressImageForThumbnail(buffer);
    const thumbnailFilename = getOptimizedFilename(filename, 'webp', 'thumbnail');
    const thumbnailKey = `covers/${userId}/${taskId}/${thumbnailFilename}`;

    const thumbnailCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: thumbnailKey,
      Body: thumbnailData.buffer,
      ContentType: 'image/webp',
      Metadata: {
        taskId,
        userId,
        type: 'cover_thumbnail',
        width: thumbnailData.width.toString(),
        height: thumbnailData.height.toString(),
      },
      CacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year
    });

    await getR2Client().send(thumbnailCommand);
    const thumbnailUrl = `${PUBLIC_DOMAIN}/${thumbnailKey}`;

    console.log('[R2 Upload] Thumbnail uploaded:', {
      url: thumbnailUrl,
      size: `${(thumbnailData.size / 1024).toFixed(2)}KB`,
    });

    // 2. Optimize and upload original (PNG, high quality, for download)
    const originalData = await optimizeOriginalImage(buffer);
    const originalFilename = getOptimizedFilename(filename, 'png', 'original');
    const originalKey = `covers/${userId}/${taskId}/${originalFilename}`;

    const originalCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: originalKey,
      Body: originalData.buffer,
      ContentType: 'image/png',
      Metadata: {
        taskId,
        userId,
        type: 'cover_original',
        width: originalData.width.toString(),
        height: originalData.height.toString(),
      },
      CacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year
    });

    await getR2Client().send(originalCommand);
    const originalUrl = `${PUBLIC_DOMAIN}/${originalKey}`;

    console.log('[R2 Upload] Original uploaded:', {
      url: originalUrl,
      size: `${(originalData.size / 1024).toFixed(2)}KB`,
    });

    console.log('[R2 Upload] Dual-version upload complete:', {
      thumbnailUrl,
      originalUrl,
      totalSavings: `${(((buffer.length - thumbnailData.size) / buffer.length) * 100).toFixed(1)}%`,
    });

    return {
      thumbnailUrl,
      originalUrl,
    };
  } catch (error) {
    console.error('[R2 Upload] Error uploading dual-version cover image:', error);
    throw error;
  }
}

/**
 * 上传封面图片到R2（单版本，保持向后兼容）
 * @deprecated Use uploadCoverImageWithVersions for better performance
 */
export async function uploadCoverImage(
  buffer: Buffer,
  taskId: string,
  filename: string,
  userId: string,
  contentType?: string | null
): Promise<string> {
  try {
    const key = `covers/${userId}/${taskId}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: resolveImageContentType(filename, contentType),
      Metadata: {
        taskId,
        userId,
        type: 'cover'
      }
    });

    await getR2Client().send(command);

    // 返回公开访问URL
    return `${PUBLIC_DOMAIN}/${key}`;
  } catch (error) {
    console.error('Error uploading cover image:', error);
    throw error;
  }
}

function resolveImageContentType(filename: string, provided?: string | null): string {
  if (provided && provided.trim() !== '') return provided;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'application/octet-stream';
}

/**
 * 获取用户文件列表
 */
export async function getUserFiles(userId: string): Promise<Array<{
  key: string;
  url: string;
  type: 'audio' | 'cover';
  taskId: string;
  filename: string;
  lastModified: Date;
}>> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `audio/${userId}/`,
      MaxKeys: 1000
    });

    const response = await r2Client.send(command);
    const audioFiles = (response.Contents || []).map(obj => ({
      key: obj.Key!,
      url: `${PUBLIC_DOMAIN}/${obj.Key}`,
      type: 'audio' as const,
      taskId: obj.Key!.split('/')[2] || '',
      filename: obj.Key!.split('/').pop() || '',
      lastModified: obj.LastModified || new Date()
    }));

    // 获取封面文件
    const coverCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `covers/${userId}/`,
      MaxKeys: 1000
    });

    const coverResponse = await r2Client.send(coverCommand);
    const coverFiles = (coverResponse.Contents || []).map(obj => ({
      key: obj.Key!,
      url: `${PUBLIC_DOMAIN}/${obj.Key}`,
      type: 'cover' as const,
      taskId: obj.Key!.split('/')[2] || '',
      filename: obj.Key!.split('/').pop() || '',
      lastModified: obj.LastModified || new Date()
    }));

    return [...audioFiles, ...coverFiles];
  } catch (error) {
    console.error('Error getting user files:', error);
    throw error;
  }
}

/**
 * 获取所有音频文件（用于清理脚本）
 */
export async function getAllAudioFiles(): Promise<Array<{
  key: string;
  url: string;
  taskId: string;
  userId: string;
  filename: string;
  lastModified: Date;
}>> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'audio/',
      MaxKeys: 10000
    });

    const response = await r2Client.send(command);
    const audioFiles = (response.Contents || []).map(obj => {
      const keyParts = obj.Key!.split('/');
      return {
        key: obj.Key!,
        url: `${PUBLIC_DOMAIN}/${obj.Key}`,
        taskId: keyParts[2] || '',
        userId: keyParts[1] || '',
        filename: keyParts[3] || '',
        lastModified: obj.LastModified || new Date()
      };
    });

    return audioFiles;
  } catch (error) {
    console.error('Error getting all audio files:', error);
    throw error;
  }
}

/**
 * 删除用户文件
 */
export async function deleteUserFiles(userId: string, fileKeys: string[]): Promise<void> {
  try {
    const deletePromises = fileKeys.map(key => {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      return r2Client.send(command);
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting user files:', error);
    throw error;
  }
}

/**
 * 删除指定的音频文件
 */
export async function deleteAudioFiles(fileKeys: string[]): Promise<void> {
  try {
    const deletePromises = fileKeys.map(key => {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      return r2Client.send(command);
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting audio files:', error);
    throw error;
  }
}

/**
 * 检查R2文件是否存在
 */
export async function checkR2FileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    await getR2Client().send(command);
    return true;
  } catch (error: any) {
    // 404 表示文件不存在
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // 其他错误抛出
    throw error;
  }
}

/**
 * 从R2 URL提取key
 */
export function extractKeyFromR2Url(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // 移除开头的斜杠
    const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    return path || null;
  } catch {
    return null;
  }
}

/**
 * 根据 taskId 和 userId 查找 R2 中的 WAV 文件
 * 返回找到的第一个文件的 key 和 URL，如果不存在则返回 null
 */
export async function findWavFileByTaskId(
  taskId: string,
  userId: string
): Promise<{ key: string; url: string } | null> {
  try {
    const bucketName = process.env.R2_BUCKET_NAME || BUCKET_NAME;
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || PUBLIC_DOMAIN;
    
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME is not set');
    }
    
    if (!publicDomain) {
      throw new Error('R2_PUBLIC_DOMAIN is not set');
    }
    
    // 列出 wav/{userId}/{taskId}/ 下的所有文件
    const prefix = `wav/${userId}/${taskId}/`;
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 10 // 通常一个 taskId 只有一个文件
    });
    
    const response = await getR2Client().send(command);
    
    if (response.Contents && response.Contents.length > 0) {
      // 返回第一个找到的文件
      const firstFile = response.Contents[0];
      const key = firstFile.Key!;
      const url = `${publicDomain}/${key}`;
      return { key, url };
    }
    
    return null;
  } catch (error) {
    console.error('Error finding WAV file by taskId:', error);
    throw error;
  }
}
