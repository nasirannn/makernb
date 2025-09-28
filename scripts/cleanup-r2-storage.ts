#!/usr/bin/env npx tsx

/**
 * R2存储清理脚本
 *
 * 此脚本会：
 * 1. 扫描数据库中所有有效的音频和封面文件引用
 * 2. 列出R2存储中的所有文件
 * 3. 找出没有在数据库中引用的文件
 * 4. 删除这些无用文件
 */

// 加载环境变量
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载.env.local文件
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { ListObjectsV2Command, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

// 创建R2客户端（直接在脚本中配置，确保环境变量正确加载）
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
import { Client } from 'pg';

// 创建数据库客户端
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 简化的查询函数
async function dbQuery(text: string, params?: any[]) {
  try {
    const result = await dbClient.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

interface FileReference {
  key: string;
  type: 'audio' | 'cover';
  source: string; // 来源表名
  id: string; // 记录ID
}

/**
 * 获取数据库中所有有效的文件引用
 */
async function getValidFileReferences(): Promise<Set<string>> {
  const validFiles = new Set<string>();
  
  console.log('🔍 扫描数据库中的有效文件引用...');
  
  // 1. 获取所有有效的音频文件 (music_tracks表中未删除的记录)
  console.log('  📀 扫描音频文件引用...');
  const audioResult = await dbQuery(`
    SELECT 
      mt.audio_url,
      mt.id as track_id,
      mg.task_id,
      mg.user_id
    FROM music_tracks mt
    INNER JOIN music_generations mg ON mt.music_generation_id = mg.id
    WHERE mt.audio_url IS NOT NULL 
      AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      AND (mg.is_deleted IS NULL OR mg.is_deleted = FALSE)
  `);
  
  for (const row of audioResult.rows) {
    if (row.audio_url) {
      // 从URL中提取R2 key
      const key = extractR2KeyFromUrl(row.audio_url);
      if (key) {
        validFiles.add(key);
        console.log(`    ✓ 音频: ${key} (track: ${row.track_id})`);
      }
    }
  }
  
  // 2. 获取所有有效的封面图片 (cover_images表)
  console.log('  🖼️  扫描封面图片引用...');
  const coverResult = await dbQuery(`
    SELECT 
      ci.r2_url,
      ci.id as cover_id,
      ci.music_track_id,
      mt.id as track_id
    FROM cover_images ci
    LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
    LEFT JOIN music_generations mg ON mt.music_generation_id = mg.id
    WHERE ci.r2_url IS NOT NULL
      AND (
        ci.music_track_id IS NULL 
        OR (
          (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
          AND (mg.is_deleted IS NULL OR mg.is_deleted = FALSE)
        )
      )
  `);
  
  for (const row of coverResult.rows) {
    if (row.r2_url) {
      const key = extractR2KeyFromUrl(row.r2_url);
      if (key) {
        validFiles.add(key);
        console.log(`    ✓ 封面: ${key} (cover: ${row.cover_id})`);
      }
    }
  }
  
  console.log(`📊 找到 ${validFiles.size} 个有效文件引用`);
  return validFiles;
}

/**
 * 从R2 URL中提取key
 */
function extractR2KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // 移除开头的斜杠并解码URL编码
    const key = urlObj.pathname.substring(1);
    return decodeURIComponent(key);
  } catch (error) {
    console.warn(`⚠️  无法解析URL: ${url}`);
    return null;
  }
}

/**
 * 列出R2存储中的所有文件
 */
async function listAllR2Files(): Promise<{files: string[], totalSize: number}> {
  console.log('📂 扫描R2存储中的所有文件...');

  const allFiles: string[] = [];
  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    });

    const response = await r2Client.send(command);

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          allFiles.push(object.Key);
          totalSize += object.Size || 0;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`📊 R2存储中共有 ${allFiles.length} 个文件`);
  console.log(`💾 总存储大小: ${formatBytes(totalSize)}`);

  return {files: allFiles, totalSize};
}

/**
 * 格式化字节数
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 找出无用的文件
 */
function findUnusedFiles(allFiles: string[], validFiles: Set<string>): string[] {
  console.log('🔍 查找无用文件...');

  const unusedFiles = allFiles.filter(file => !validFiles.has(file));

  console.log(`📊 找到 ${unusedFiles.length} 个无用文件`);

  // 按类型分组显示
  const audioFiles = unusedFiles.filter(f => f.startsWith('audio/'));
  const coverFiles = unusedFiles.filter(f => f.startsWith('covers/'));
  const otherFiles = unusedFiles.filter(f => !f.startsWith('audio/') && !f.startsWith('covers/'));

  console.log(`  📀 音频文件: ${audioFiles.length} 个`);
  console.log(`  🖼️  封面文件: ${coverFiles.length} 个`);
  console.log(`  📄 其他文件: ${otherFiles.length} 个`);

  // 显示一些示例文件
  if (unusedFiles.length > 0) {
    console.log('\n📋 无用文件示例:');
    unusedFiles.slice(0, 10).forEach(file => {
      console.log(`  🗑️  ${file}`);
    });
    if (unusedFiles.length > 10) {
      console.log(`  ... 还有 ${unusedFiles.length - 10} 个文件`);
    }
  }

  return unusedFiles;
}

/**
 * 删除无用文件
 */
async function deleteUnusedFiles(unusedFiles: string[], dryRun: boolean = true): Promise<void> {
  if (unusedFiles.length === 0) {
    console.log('✅ 没有需要删除的文件');
    return;
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN - 以下文件将被删除（实际未删除）:');
    unusedFiles.forEach(file => {
      console.log(`  🗑️  ${file}`);
    });
    console.log(`\n💡 要实际删除这些文件，请运行: npm run cleanup-r2 -- --delete`);
    return;
  }
  
  console.log('🗑️  开始删除无用文件...');
  
  let deletedCount = 0;
  let errorCount = 0;
  
  for (const file of unusedFiles) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: file
      });
      
      await r2Client.send(command);
      deletedCount++;
      console.log(`  ✅ 已删除: ${file}`);
    } catch (error) {
      errorCount++;
      console.error(`  ❌ 删除失败: ${file}`, error);
    }
  }
  
  console.log(`\n📊 删除完成:`);
  console.log(`  ✅ 成功删除: ${deletedCount} 个文件`);
  console.log(`  ❌ 删除失败: ${errorCount} 个文件`);
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始R2存储清理...\n');

    // 连接数据库
    console.log('🔌 连接数据库...');
    await dbClient.connect();
    console.log('✅ 数据库连接成功\n');

    // 检查命令行参数
    const args = process.argv.slice(2);
    const shouldDelete = args.includes('--delete');
    const dryRun = !shouldDelete;

    if (dryRun) {
      console.log('ℹ️  运行在DRY RUN模式，不会实际删除文件\n');
    } else {
      console.log('⚠️  运行在DELETE模式，将实际删除文件\n');
    }

    // 1. 获取数据库中的有效文件引用
    const validFiles = await getValidFileReferences();
    
    console.log('');
    
    // 2. 列出R2中的所有文件
    const {files: allFiles, totalSize} = await listAllR2Files();

    console.log('');

    // 3. 找出无用文件
    const unusedFiles = findUnusedFiles(allFiles, validFiles);
    
    console.log('');
    
    // 4. 删除无用文件
    await deleteUnusedFiles(unusedFiles, dryRun);
    
    console.log('\n✅ R2存储清理完成!');

  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error);
    process.exit(1);
  } finally {
    // 断开数据库连接
    try {
      await dbClient.end();
      console.log('🔌 数据库连接已断开');
    } catch (error) {
      console.error('⚠️  断开数据库连接时出错:', error);
    }
  }
}

// 运行主函数
if (require.main === module) {
  main();
}
