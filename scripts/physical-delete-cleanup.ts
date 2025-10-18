#!/usr/bin/env npx tsx

/**
 * 物理删除脚本 - 彻底清理逻辑删除的歌曲数据
 *
 * 此脚本会：
 * 1. 找出所有逻辑删除的音乐生成记录和音轨
 * 2. 收集相关的R2文件引用
 * 3. 从数据库中物理删除这些记录
 * 4. 从R2存储中删除对应的文件
 * 5. 提供详细的操作日志和回滚信息
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

// 加载.env.local文件
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { ListObjectsV2Command, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Client } from 'pg';

// 创建R2客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

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

interface DeletedTrackInfo {
  track_id: string;
  generation_id: string;
  audio_url?: string;
  suno_track_id: string;
  user_id: string;
  task_id?: string;
  title?: string;
  deleted_at?: string;
}

interface DeletedCoverInfo {
  cover_id: string;
  r2_url: string;
  track_id?: string;
}

interface DeletionSummary {
  tracks: DeletedTrackInfo[];
  covers: DeletedCoverInfo[];
  r2Files: string[];
  estimatedR2Size: number;
}

/**
 * 从R2 URL中提取key
 */
function extractR2KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const key = urlObj.pathname.substring(1);
    return decodeURIComponent(key);
  } catch (error) {
    console.warn(`⚠️  无法解析URL: ${url}`);
    return null;
  }
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
 * 获取所有逻辑删除的音轨信息
 */
async function getDeletedTracksInfo(): Promise<DeletedTrackInfo[]> {
  console.log('🔍 查找所有逻辑删除的音轨...');

  const result = await dbQuery(`
    SELECT
      mt.id as track_id,
      mt.music_generation_id as generation_id,
      mt.audio_url,
      mt.suno_track_id,
      mt.updated_at as deleted_at,
      mg.user_id,
      mg.task_id,
      mg.title
    FROM music_tracks mt
    INNER JOIN music_generations mg ON mt.music_generation_id = mg.id
    WHERE mt.is_deleted = TRUE
    ORDER BY mt.updated_at DESC
  `);

  console.log(`📊 找到 ${result.rows.length} 个逻辑删除的音轨`);
  return result.rows;
}

/**
 * 获取所有孤立的封面图片（关联到已删除的音轨）
 */
async function getOrphanedCovers(): Promise<DeletedCoverInfo[]> {
  console.log('🔍 查找孤立的封面图片...');

  const result = await dbQuery(`
    SELECT
      ci.id as cover_id,
      ci.r2_url,
      ci.music_track_id as track_id
    FROM cover_images ci
    LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
    WHERE
      ci.r2_url IS NOT NULL
      AND (
        ci.music_track_id IS NULL
        OR mt.is_deleted = TRUE
      )
  `);

  console.log(`📊 找到 ${result.rows.length} 个孤立的封面图片`);
  return result.rows;
}

/**
 * 收集所有需要删除的R2文件
 */
async function collectR2FilesToDelete(tracks: DeletedTrackInfo[], covers: DeletedCoverInfo[]): Promise<string[]> {
  console.log('🔍 收集需要删除的R2文件...');

  const filesToDelete: string[] = [];

  // 收集音频文件
  for (const track of tracks) {
    if (track.audio_url) {
      const key = extractR2KeyFromUrl(track.audio_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  📀 音频文件: ${key} (track: ${track.track_id})`);
      }
    }
  }

  // 收集封面文件
  for (const cover of covers) {
    if (cover.r2_url) {
      const key = extractR2KeyFromUrl(cover.r2_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🖼️  封面文件: ${key} (cover: ${cover.cover_id})`);
      }
    }
  }

  // 去重
  const uniqueFiles = Array.from(new Set(filesToDelete));
  console.log(`📊 总共需要删除 ${uniqueFiles.length} 个R2文件`);

  return uniqueFiles;
}

/**
 * 估算R2文件大小
 */
async function estimateR2FileSize(files: string[]): Promise<number> {
  console.log('📏 估算R2文件大小...');

  let totalSize = 0;
  let checkedCount = 0;

  for (const file of files) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: file,
        MaxKeys: 1
      });

      const response = await r2Client.send(command);
      if (response.Contents && response.Contents.length > 0) {
        totalSize += response.Contents[0].Size || 0;
        checkedCount++;
      }
    } catch (error) {
      console.warn(`⚠️  无法获取文件大小: ${file}`);
    }
  }

  console.log(`📊 估算总大小: ${formatBytes(totalSize)} (检查了 ${checkedCount}/${files.length} 个文件)`);
  return totalSize;
}

/**
 * 生成删除摘要
 */
async function generateDeletionSummary(): Promise<DeletionSummary> {
  console.log('\n📋 生成删除摘要...\n');

  const tracks = await getDeletedTracksInfo();
  const covers = await getOrphanedCovers();
  const r2Files = await collectR2FilesToDelete(tracks, covers);
  const estimatedR2Size = await estimateR2FileSize(r2Files);

  return {
    tracks,
    covers,
    r2Files,
    estimatedR2Size
  };
}

/**
 * 保存删除摘要到文件（用于回滚）
 */
async function saveDeletionSummary(summary: DeletionSummary): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `deletion-summary-${timestamp}.json`;
  const filepath = path.join(__dirname, '../logs', filename);

  // 确保logs目录存在
  await fs.mkdir(path.dirname(filepath), { recursive: true });

  await fs.writeFile(filepath, JSON.stringify(summary, null, 2));
  console.log(`💾 删除摘要已保存到: ${filepath}`);

  return filepath;
}

/**
 * 从R2删除文件
 */
async function deleteR2Files(files: string[], dryRun: boolean = true): Promise<{ success: number; failed: number }> {
  if (files.length === 0) {
    console.log('✅ 没有需要删除的R2文件');
    return { success: 0, failed: 0 };
  }

  if (dryRun) {
    console.log('🔍 DRY RUN - 以下R2文件将被删除（实际未删除）:');
    files.forEach(file => {
      console.log(`  🗑️  ${file}`);
    });
    return { success: 0, failed: 0 };
  }

  console.log('🗑️  开始删除R2文件...');

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: file
      });

      await r2Client.send(command);
      success++;
      console.log(`  ✅ R2文件已删除: ${file}`);
    } catch (error) {
      failed++;
      console.error(`  ❌ R2文件删除失败: ${file}`, error);
    }
  }

  console.log(`📊 R2文件删除结果: 成功 ${success}, 失败 ${failed}`);
  return { success, failed };
}

/**
 * 从数据库物理删除记录
 */
async function physicallyDeleteFromDatabase(summary: DeletionSummary, dryRun: boolean = true): Promise<{
  tracksDeleted: number;
  coversDeleted: number;
  generationsDeleted: number;
}> {
  if (dryRun) {
    console.log('🔍 DRY RUN - 以下数据库记录将被删除（实际未删除）:');
    console.log(`  📀 音轨记录: ${summary.tracks.length} 个`);
    console.log(`  🖼️  封面记录: ${summary.covers.length} 个`);
    return { tracksDeleted: 0, coversDeleted: 0, generationsDeleted: 0 };
  }

  console.log('🗑️  开始从数据库物理删除记录...');

  let tracksDeleted = 0;
  let coversDeleted = 0;
  let generationsDeleted = 0;

  // 开始事务
  await dbQuery('BEGIN');

  try {
    // 1. 删除所有相关的封面图片记录（包括关联到要删除音轨的封面）
    if (summary.tracks.length > 0) {
      const trackIds = summary.tracks.map(t => t.track_id);
      const coverResult = await dbQuery(
        'DELETE FROM cover_images WHERE music_track_id = ANY($1) RETURNING id',
        [trackIds]
      );
      coversDeleted = coverResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${coversDeleted} 个关联封面记录`);
    }
    
    // 2. 删除孤立的封面图片记录
    if (summary.covers.length > 0) {
      const coverIds = summary.covers.map(c => c.cover_id);
      const coverResult = await dbQuery(
        'DELETE FROM cover_images WHERE id = ANY($1) RETURNING id',
        [coverIds]
      );
      coversDeleted += coverResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${coverResult.rowCount || 0} 个孤立封面记录`);
    }

    // 3. 删除音轨记录
    if (summary.tracks.length > 0) {
      const trackIds = summary.tracks.map(t => t.track_id);
      const trackResult = await dbQuery(
        'DELETE FROM music_tracks WHERE id = ANY($1) RETURNING id',
        [trackIds]
      );
      tracksDeleted = trackResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${tracksDeleted} 个音轨记录`);
    }

    // 4. 删除没有关联音轨的生成记录
    const generationResult = await dbQuery(`
      DELETE FROM music_generations
      WHERE is_deleted = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM music_tracks
          WHERE music_generation_id = music_generations.id
        )
      RETURNING id
    `);
    generationsDeleted = generationResult.rowCount || 0;
    console.log(`  ✅ 删除了 ${generationsDeleted} 个生成记录`);

    // 提交事务
    await dbQuery('COMMIT');
    console.log('✅ 数据库删除操作已提交');

  } catch (error) {
    // 回滚事务
    await dbQuery('ROLLBACK');
    console.error('❌ 数据库删除失败，已回滚:', error);
    throw error;
  }

  return { tracksDeleted, coversDeleted, generationsDeleted };
}

/**
 * 显示删除摘要
 */
function displayDeletionSummary(summary: DeletionSummary) {
  console.log('\n📊 删除摘要:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📀 逻辑删除的音轨: ${summary.tracks.length} 个`);
  console.log(`🖼️  孤立的封面图片: ${summary.covers.length} 个`);
  console.log(`📁 需要删除的R2文件: ${summary.r2Files.length} 个`);
  console.log(`💾 估算释放空间: ${formatBytes(summary.estimatedR2Size)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (summary.tracks.length > 0) {
    console.log('\n📀 音轨详情 (前10个):');
    summary.tracks.slice(0, 10).forEach((track, index) => {
      console.log(`  ${index + 1}. ${track.title || 'Unknown'} (${track.track_id})`);
      console.log(`     用户: ${track.user_id}, 删除时间: ${track.deleted_at}`);
    });
    if (summary.tracks.length > 10) {
      console.log(`     ... 还有 ${summary.tracks.length - 10} 个音轨`);
    }
  }

  if (summary.covers.length > 0) {
    console.log('\n🖼️  封面详情 (前10个):');
    summary.covers.slice(0, 10).forEach((cover, index) => {
      console.log(`  ${index + 1}. ${cover.cover_id} (关联音轨: ${cover.track_id || '无'})`);
    });
    if (summary.covers.length > 10) {
      console.log(`     ... 还有 ${summary.covers.length - 10} 个封面`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始物理删除逻辑删除的数据...\n');

    // 检查命令行参数
    const args = process.argv.slice(2);
    const shouldDelete = args.includes('--delete');
    const skipR2 = args.includes('--skip-r2');
    const skipDb = args.includes('--skip-db');
    const dryRun = !shouldDelete;

    if (dryRun) {
      console.log('ℹ️  运行在 DRY RUN 模式，不会实际删除任何数据');
      console.log('💡 要实际删除，请使用: --delete');
      console.log('💡 只删除数据库: --delete --skip-r2');
      console.log('💡 只删除R2文件: --delete --skip-db\n');
    } else {
      console.log('⚠️  运行在 DELETE 模式，将实际删除数据！');
      if (skipR2) console.log('ℹ️  跳过R2文件删除');
      if (skipDb) console.log('ℹ️  跳过数据库删除');
      console.log('');
    }

    // 连接数据库
    console.log('🔌 连接数据库...');
    await dbClient.connect();
    console.log('✅ 数据库连接成功\n');

    // 生成删除摘要
    const summary = await generateDeletionSummary();

    // 显示摘要
    displayDeletionSummary(summary);

    // 如果没有需要删除的数据，退出
    if (summary.tracks.length === 0 && summary.covers.length === 0) {
      console.log('\n✅ 没有需要删除的数据，程序结束');
      return;
    }

    // 保存删除摘要
    const summaryFile = await saveDeletionSummary(summary);

    if (!dryRun) {
      // 确认删除
      console.log('\n⚠️  WARNING: 此操作不可逆！');
      console.log('确认删除上述数据？输入 "CONFIRM DELETE" 继续:');

      // 注意：在脚本中这里需要手动确认
      // 为了安全，我们要求显式的确认步骤
      if (!args.includes('--force')) {
        console.log('❌ 未检测到 --force 参数，为了安全考虑，请添加 --force 参数确认删除');
        console.log('完整命令示例: npm run physical-delete -- --delete --force');
        return;
      }
    }

    console.log('\n🗑️  开始删除操作...\n');

    let dbResults = { tracksDeleted: 0, coversDeleted: 0, generationsDeleted: 0 };
    let r2Results = { success: 0, failed: 0 };

    // 执行数据库删除
    if (!skipDb) {
      dbResults = await physicallyDeleteFromDatabase(summary, dryRun);
    }

    // 执行R2文件删除
    if (!skipR2) {
      r2Results = await deleteR2Files(summary.r2Files, dryRun);
    }

    // 显示最终结果
    console.log('\n🎉 物理删除操作完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 删除结果:');
    console.log(`  📀 音轨记录: ${dbResults.tracksDeleted} 个`);
    console.log(`  🖼️  封面记录: ${dbResults.coversDeleted} 个`);
    console.log(`  🎵 生成记录: ${dbResults.generationsDeleted} 个`);
    console.log(`  📁 R2文件: ${r2Results.success} 个成功，${r2Results.failed} 个失败`);
    console.log(`  💾 删除摘要保存在: ${summaryFile}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ 物理删除过程中发生错误:', error);
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

export {
  getDeletedTracksInfo,
  getOrphanedCovers,
  collectR2FilesToDelete,
  physicallyDeleteFromDatabase,
  deleteR2Files
};