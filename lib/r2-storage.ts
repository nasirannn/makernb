import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// R2客户端配置
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN;

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

    await r2Client.send(command);
    
    // 返回公开访问URL
    const publicUrl = `${PUBLIC_DOMAIN}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading audio file:', error);
    throw error;
  }
}

/**
 * 上传封面图片到R2
 */
export async function uploadCoverImage(
  buffer: Buffer,
  taskId: string,
  filename: string,
  userId: string
): Promise<string> {
  try {
    const key = `covers/${userId}/${taskId}/${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      Metadata: {
        taskId,
        userId,
        type: 'cover'
      }
    });

    await r2Client.send(command);
    
    // 返回公开访问URL
    return `${PUBLIC_DOMAIN}/${key}`;
  } catch (error) {
    console.error('Error uploading cover image:', error);
    throw error;
  }
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
