#!/usr/bin/env npx tsx

/**
 * 删除指定用户的所有数据脚本
 * 
 * 此脚本会：
 * 1. 查找指定用户的所有音乐生成记录和音轨
 * 2. 收集相关的R2文件引用
 * 3. 从数据库中物理删除这些记录
 * 4. 从R2存储中删除对应的文件
 * 5. 提供详细的操作日志
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
  connectionString: process.env.DATABASE_URL?.replace('channel_binding=require', 'channel_binding=disable'),
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

interface UserTrackInfo {
  track_id: string;
  generation_id: string;
  audio_url?: string;
  cover_image_url?: string;
  suno_track_id: string;
  user_id: string;
  task_id?: string;
  title?: string;
  created_at: string;
}

interface UserVocalSeparationInfo {
  separation_id: string;
  user_id: string;
  original_audio_url?: string;
  vocal_audio_url?: string;
  instrumental_audio_url?: string;
  created_at: string;
}

interface UserGenerationErrorInfo {
  error_id: string;
  reference_id: string;
  error_type: string;
  created_at: string;
}

interface UserLyricsInfo {
  lyrics_id: string;
  music_id: string;
  title?: string;
  created_at: string;
}

interface UserDeletionSummary {
  tracks: UserTrackInfo[];
  vocalSeparations: UserVocalSeparationInfo[];
  generationErrors: UserGenerationErrorInfo[];
  lyrics: UserLyricsInfo[];
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
 * 获取用户的所有音轨信息
 */
async function getUserTracksInfo(userId: string): Promise<UserTrackInfo[]> {
  console.log(`🔍 查找用户 ${userId} 的所有音轨...`);

  const query = `
    SELECT
      mt.id as track_id,
      mt.music_id as generation_id,
      mt.audio_url,
      mt.cover_image_url,
      mt.suno_track_id,
      mt.created_at,
      mg.user_id,
      mg.task_id,
      mg.title
    FROM tracks mt
    INNER JOIN music mg ON mt.music_id = mg.id
    WHERE mg.user_id = $1
    ORDER BY mt.created_at DESC
  `;

  const result = await dbQuery(query, [userId]);
  console.log(`📊 找到 ${result.rows.length} 个音轨`);
  return result.rows;
}

/**
 * 获取用户的所有人声分离记录
 */
async function getUserVocalSeparations(userId: string): Promise<UserVocalSeparationInfo[]> {
  console.log(`🔍 查找用户 ${userId} 的所有人声分离记录...`);

  const query = `
    SELECT
      id as separation_id,
      user_id,
      original_audio_url,
      vocal_audio_url,
      instrumental_audio_url,
      created_at
    FROM vocal_separations
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;

  const result = await dbQuery(query, [userId]);
  console.log(`📊 找到 ${result.rows.length} 个人声分离记录`);
  return result.rows;
}

/**
 * 获取用户的所有生成错误
 */
async function getUserGenerationErrors(userId: string): Promise<UserGenerationErrorInfo[]> {
  console.log(`🔍 查找用户 ${userId} 的所有生成错误...`);

  const query = `
    SELECT
      ge.id as error_id,
      ge.reference_id,
      ge.error_type,
      ge.created_at
    FROM generation_errors ge
    LEFT JOIN music mg ON ge.reference_id::text = mg.id::text AND ge.error_type = 'music_generation'
    LEFT JOIN vocal_separations vs ON ge.reference_id::text = vs.id::text AND ge.error_type = 'vocal_separation'
    WHERE
      ((ge.error_type = 'music_generation' AND mg.user_id = $1)
      OR (ge.error_type = 'vocal_separation' AND vs.user_id = $1))
    ORDER BY ge.created_at DESC
  `;

  const result = await dbQuery(query, [userId]);
  console.log(`📊 找到 ${result.rows.length} 个生成错误`);
  return result.rows;
}

/**
 * 获取用户的所有歌词记录
 */
async function getUserLyrics(userId: string): Promise<UserLyricsInfo[]> {
  console.log(`🔍 查找用户 ${userId} 的所有歌词记录...`);

  const query = `
    SELECT
      l.id as lyrics_id,
      l.music_id,
      l.title,
      l.created_at
    FROM lyrics l
    INNER JOIN music mg ON l.music_id = mg.id
    WHERE mg.user_id = $1
    ORDER BY l.created_at DESC
  `;

  const result = await dbQuery(query, [userId]);
  console.log(`📊 找到 ${result.rows.length} 个歌词记录`);
  return result.rows;
}

/**
 * 收集所有需要删除的R2文件
 */
async function collectR2FilesToDelete(
  tracks: UserTrackInfo[], 
  vocalSeparations: UserVocalSeparationInfo[]
): Promise<string[]> {
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
    
    // 收集封面文件
    if (track.cover_image_url) {
      const key = extractR2KeyFromUrl(track.cover_image_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🖼️  封面文件: ${key} (track: ${track.track_id})`);
      }
    }
  }

  // 收集人声分离音频文件
  for (const separation of vocalSeparations) {
    // 原始音频文件
    if (separation.original_audio_url) {
      const key = extractR2KeyFromUrl(separation.original_audio_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎤 原始音频: ${key} (separation: ${separation.separation_id})`);
      }
    }

    // 人声音频文件
    if (separation.vocal_audio_url) {
      const key = extractR2KeyFromUrl(separation.vocal_audio_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎵 人声音频: ${key} (separation: ${separation.separation_id})`);
      }
    }

    // 伴奏音频文件
    if (separation.instrumental_audio_url) {
      const key = extractR2KeyFromUrl(separation.instrumental_audio_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎼 伴奏音频: ${key} (separation: ${separation.separation_id})`);
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
 * 生成用户删除摘要
 */
async function generateUserDeletionSummary(userId: string): Promise<UserDeletionSummary> {
  console.log(`\n📋 生成用户 ${userId} 的删除摘要...\n`);

  const tracks = await getUserTracksInfo(userId);
  const vocalSeparations = await getUserVocalSeparations(userId);
  const generationErrors = await getUserGenerationErrors(userId);
  const lyrics = await getUserLyrics(userId);
  const r2Files = await collectR2FilesToDelete(tracks, vocalSeparations);
  const estimatedR2Size = await estimateR2FileSize(r2Files);

  return {
    tracks,
    vocalSeparations,
    generationErrors,
    lyrics,
    r2Files,
    estimatedR2Size
  };
}

/**
 * 保存删除摘要到文件
 */
async function saveDeletionSummary(summary: UserDeletionSummary, userId: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `user-deletion-summary-${userId}-${timestamp}.json`;
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
 * 从数据库物理删除用户的所有记录
 */
async function physicallyDeleteUserFromDatabase(summary: UserDeletionSummary, userId: string, dryRun: boolean = true): Promise<{
  tracksDeleted: number;
  generationsDeleted: number;
  vocalSeparationsDeleted: number;
  generationErrorsDeleted: number;
  lyricsDeleted: number;
}> {
  if (dryRun) {
    console.log('🔍 DRY RUN - 以下数据库记录将被删除（实际未删除）:');
    console.log(`  📀 音轨记录: ${summary.tracks.length} 个`);
    console.log(`  🎤 人声分离记录: ${summary.vocalSeparations.length} 个`);
    console.log(`  ❌ 生成错误记录: ${summary.generationErrors.length} 个`);
    console.log(`  📝 歌词记录: ${summary.lyrics.length} 个`);
    return { 
      tracksDeleted: 0, 
      generationsDeleted: 0,
      vocalSeparationsDeleted: 0,
      generationErrorsDeleted: 0,
      lyricsDeleted: 0
    };
  }

  console.log('🗑️  开始从数据库物理删除用户记录...');

  let tracksDeleted = 0;
  let generationsDeleted = 0;
  let vocalSeparationsDeleted = 0;
  let generationErrorsDeleted = 0;
  let lyricsDeleted = 0;

  // 开始事务
  await dbQuery('BEGIN');

  try {
    // 1. 删除生成错误记录（最先删除，避免外键约束）
    if (summary.generationErrors.length > 0) {
      const errorIds = summary.generationErrors.map(e => e.error_id);
      const errorResult = await dbQuery(
        'DELETE FROM generation_errors WHERE id = ANY($1) RETURNING id',
        [errorIds]
      );
      generationErrorsDeleted = errorResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${generationErrorsDeleted} 个生成错误记录`);
    }

    // 2. 删除歌词记录
    if (summary.lyrics.length > 0) {
      const lyricsIds = summary.lyrics.map(l => l.lyrics_id);
      const lyricsResult = await dbQuery(
        'DELETE FROM lyrics WHERE id = ANY($1) RETURNING id',
        [lyricsIds]
      );
      lyricsDeleted = lyricsResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${lyricsDeleted} 个歌词记录`);
    }

    // 3. 删除音轨记录
    if (summary.tracks.length > 0) {
      const trackIds = summary.tracks.map(t => t.track_id);
      const trackResult = await dbQuery(
        'DELETE FROM tracks WHERE id = ANY($1) RETURNING id',
        [trackIds]
      );
      tracksDeleted = trackResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${tracksDeleted} 个音轨记录`);
    }

    // 4. 删除人声分离记录
    if (summary.vocalSeparations.length > 0) {
      const separationIds = summary.vocalSeparations.map(v => v.separation_id);
      const separationResult = await dbQuery(
        'DELETE FROM vocal_separations WHERE id = ANY($1) RETURNING id',
        [separationIds]
      );
      vocalSeparationsDeleted = separationResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${vocalSeparationsDeleted} 个人声分离记录`);
    }

    // 5. 删除音乐生成记录
    const generationResult = await dbQuery(
      'DELETE FROM music WHERE user_id = $1 RETURNING id',
      [userId]
    );
    generationsDeleted = generationResult.rowCount || 0;
    console.log(`  ✅ 删除了 ${generationsDeleted} 个音乐生成记录`);

    // 提交事务
    await dbQuery('COMMIT');
    console.log('✅ 数据库删除操作已提交');

  } catch (error) {
    // 回滚事务
    await dbQuery('ROLLBACK');
    console.error('❌ 数据库删除失败，已回滚:', error);
    throw error;
  }

  return { 
    tracksDeleted, 
    generationsDeleted,
    vocalSeparationsDeleted,
    generationErrorsDeleted,
    lyricsDeleted
  };
}

/**
 * 显示删除摘要
 */
function displayUserDeletionSummary(summary: UserDeletionSummary, userId: string) {
  console.log(`\n📊 用户 ${userId} 删除摘要:`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📀 音轨: ${summary.tracks.length} 个`);
  console.log(`🎤 人声分离: ${summary.vocalSeparations.length} 个`);
  console.log(`❌ 生成错误: ${summary.generationErrors.length} 个`);
  console.log(`📝 歌词记录: ${summary.lyrics.length} 个`);
  console.log(`📁 需要删除的R2文件: ${summary.r2Files.length} 个`);
  console.log(`💾 估算释放空间: ${formatBytes(summary.estimatedR2Size)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (summary.tracks.length > 0) {
    console.log('\n📀 音轨详情 (前10个):');
    summary.tracks.slice(0, 10).forEach((track, index) => {
      console.log(`  ${index + 1}. ${track.title || 'Unknown'} (${track.track_id})`);
      console.log(`     创建时间: ${track.created_at}`);
    });
    if (summary.tracks.length > 10) {
      console.log(`     ... 还有 ${summary.tracks.length - 10} 个音轨`);
    }
  }

  if (summary.vocalSeparations.length > 0) {
    console.log('\n🎤 人声分离详情 (前10个):');
    summary.vocalSeparations.slice(0, 10).forEach((separation, index) => {
      console.log(`  ${index + 1}. ${separation.separation_id}`);
      console.log(`     创建时间: ${separation.created_at}`);
    });
    if (summary.vocalSeparations.length > 10) {
      console.log(`     ... 还有 ${summary.vocalSeparations.length - 10} 个人声分离`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始删除指定用户的所有数据...\n');

    // 检查命令行参数
    const args = process.argv.slice(2);
    const shouldDelete = args.includes('--delete');
    const skipR2 = args.includes('--skip-r2');
    const skipDb = args.includes('--skip-db');
    const dryRun = !shouldDelete;
    
    // 提取用户ID参数
    const userIdArg = args.find(arg => arg.startsWith('--user='));
    const userId = userIdArg ? userIdArg.split('=')[1] : undefined;

    if (!userId) {
      console.error('❌ 请指定用户ID: --user=USER_ID');
      console.log('💡 示例: --delete --user=cbf29fad-7e0a-4205-867f-e0dc8be5ce74');
      return;
    }

    console.log(`🎯 目标用户: ${userId}`);

    if (dryRun) {
      console.log('ℹ️  运行在 DRY RUN 模式，不会实际删除任何数据');
      console.log('💡 要实际删除，请使用: --delete');
      console.log('💡 只删除数据库: --delete --skip-r2');
      console.log('💡 只删除R2文件: --delete --skip-db');
      console.log('💡 示例: --delete --user=cbf29fad-7e0a-4205-867f-e0dc8be5ce74\n');
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
    const summary = await generateUserDeletionSummary(userId);

    // 显示摘要
    displayUserDeletionSummary(summary, userId);

    // 如果没有需要删除的数据，退出
    if (summary.tracks.length === 0 && summary.vocalSeparations.length === 0 && 
        summary.generationErrors.length === 0 && summary.lyrics.length === 0) {
      console.log('\n✅ 没有需要删除的数据，程序结束');
      return;
    }

    // 保存删除摘要
    const summaryFile = await saveDeletionSummary(summary, userId);

    if (!dryRun) {
      // 确认删除
      console.log('\n⚠️  WARNING: 此操作不可逆！');
      console.log('确认删除上述数据？输入 "CONFIRM DELETE" 继续:');

      // 为了安全，要求显式的确认步骤
      if (!args.includes('--force')) {
        console.log('❌ 未检测到 --force 参数，为了安全考虑，请添加 --force 参数确认删除');
        console.log('完整命令示例: npm run delete-user-data -- --delete --force --user=cbf29fad-7e0a-4205-867f-e0dc8be5ce74');
        return;
      }
    }

    console.log('\n🗑️  开始删除操作...\n');

    let dbResults = { 
      tracksDeleted: 0, 
      generationsDeleted: 0,
      vocalSeparationsDeleted: 0,
      generationErrorsDeleted: 0,
      lyricsDeleted: 0
    };
    let r2Results = { success: 0, failed: 0 };

    // 执行数据库删除
    if (!skipDb) {
      dbResults = await physicallyDeleteUserFromDatabase(summary, userId, dryRun);
    }

    // 执行R2文件删除
    if (!skipR2) {
      r2Results = await deleteR2Files(summary.r2Files, dryRun);
    }

    // 显示最终结果
    console.log('\n🎉 用户数据删除操作完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 删除结果:');
    console.log(`  📀 音轨记录: ${dbResults.tracksDeleted} 个`);
    console.log(`  🎵 生成记录: ${dbResults.generationsDeleted} 个`);
    console.log(`  🎤 人声分离记录: ${dbResults.vocalSeparationsDeleted} 个`);
    console.log(`  ❌ 生成错误记录: ${dbResults.generationErrorsDeleted} 个`);
    console.log(`  📝 歌词记录: ${dbResults.lyricsDeleted} 个`);
    console.log(`  📁 R2文件: ${r2Results.success} 个成功，${r2Results.failed} 个失败`);
    console.log(`  💾 删除摘要保存在: ${summaryFile}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ 删除过程中发生错误:', error);
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
  getUserTracksInfo,
  getUserVocalSeparations,
  getUserGenerationErrors,
  getUserLyrics,
  collectR2FilesToDelete,
  physicallyDeleteUserFromDatabase,
  deleteR2Files
};
