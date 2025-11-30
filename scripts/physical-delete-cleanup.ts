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

interface DeletedTrackInfo {
  track_id: string;
  generation_id: string;
  audio_url?: string;
  stream_audio_url?: string;
  suno_track_id: string;
  user_id: string;
  task_id?: string;
  title?: string;
  deleted_at?: string;
}

interface DeletedCoverInfo {
  track_id: string;
  cover_image_url: string;
  music_id: string;
}

interface DeletedVocalSeparationInfo {
  separation_id: string;
  user_id: string;
  original_audio_url?: string;
  vocal_audio_url?: string;
  instrumental_audio_url?: string;
  deleted_at?: string;
}

interface DeletedVocalRemovalInfo {
  removal_id: string;
  user_id: string;
  track_id: string;
  vocal_url?: string;
  instrumental_url?: string;
  r2_vocal_url?: string;
  r2_instrumental_url?: string;
  deleted_at?: string;
}

interface DeletedGenerationErrorInfo {
  error_id: string;
  reference_id: string;
  error_type: string;
  created_at: string;
}

interface DeletedLyricsInfo {
  lyrics_id: string;
  music_id: string;
  title?: string;
  created_at: string;
}

interface DeletedTrackWavInfo {
  conversion_id: string;
  track_id: string;
  wav_url?: string;
  wav_r2_url?: string;
  status?: string;
  updated_at?: string;
}

interface DeletionSummary {
  tracks: DeletedTrackInfo[];
  covers: DeletedCoverInfo[];
  vocalSeparations: DeletedVocalSeparationInfo[];
  vocalRemovals: DeletedVocalRemovalInfo[];
  generationErrors: DeletedGenerationErrorInfo[];
  lyrics: DeletedLyricsInfo[];
  wavConversions: DeletedTrackWavInfo[];
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
async function getDeletedTracksInfo(userId?: string): Promise<DeletedTrackInfo[]> {
  if (userId) {
    console.log(`🔍 查找用户 ${userId} 的逻辑删除音轨...`);
  } else {
    console.log('🔍 查找所有逻辑删除的音轨...');
  }

  const query = userId 
    ? `
      SELECT
        mt.id as track_id,
        mt.music_id as generation_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.suno_track_id,
        mt.updated_at as deleted_at,
        mg.user_id,
        mg.task_id,
        mg.title
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.is_deleted = TRUE AND mg.user_id = $1
      ORDER BY mt.updated_at DESC
    `
    : `
      SELECT
        mt.id as track_id,
        mt.music_id as generation_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.suno_track_id,
        mt.updated_at as deleted_at,
        mg.user_id,
        mg.task_id,
        mg.title
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.is_deleted = TRUE
      ORDER BY mt.updated_at DESC
    `;

  const params = userId ? [userId] : undefined;
  const result = await dbQuery(query, params);

  console.log(`📊 找到 ${result.rows.length} 个逻辑删除的音轨`);
  return result.rows;
}

/**
 * 获取所有孤立的封面图片（关联到已删除的音轨）
 */
async function getOrphanedCovers(userId?: string): Promise<DeletedCoverInfo[]> {
  if (userId) {
    console.log(`🔍 查找用户 ${userId} 的孤立封面图片...`);
  } else {
    console.log('🔍 查找孤立的封面图片...');
  }

  const query = userId
    ? `
      SELECT
        mt.id as track_id,
        mt.cover_image_url,
        mt.music_id
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.is_deleted = TRUE
        AND mt.cover_image_url IS NOT NULL
        AND mt.cover_image_url LIKE 'http%'
        AND mg.user_id = $1
      ORDER BY mt.updated_at DESC
    `
    : `
      SELECT
        mt.id as track_id,
        mt.cover_image_url,
        mt.music_id
      FROM tracks mt
      WHERE mt.is_deleted = TRUE
        AND mt.cover_image_url IS NOT NULL
        AND mt.cover_image_url LIKE 'http%'
      ORDER BY mt.updated_at DESC
    `;

  const params = userId ? [userId] : undefined;
  const result = await dbQuery(query, params);

  console.log(`📊 找到 ${result.rows.length} 个孤立的封面图片`);
  return result.rows;
}

/**
 * 获取所有逻辑删除的人声分离记录
 */
async function getDeletedVocalSeparations(): Promise<DeletedVocalSeparationInfo[]> {
  console.log('🔍 查找所有逻辑删除的人声分离记录...');

  // 注意：vocal_separations表没有is_deleted字段，所以返回空数组
  // 如果需要删除人声分离记录，需要其他逻辑来判断
  console.log(`📊 找到 0 个逻辑删除的人声分离记录（该表没有逻辑删除字段）`);
  return [];
}

/**
 * 获取所有逻辑删除的人声移除记录
 * 
 * 注意：vocal_removals 表已移除 is_deleted 字段，现在使用物理删除
 * 因此此函数不再返回任何记录（记录一旦删除就从数据库中移除）
 */
async function getDeletedVocalRemovals(userId?: string): Promise<DeletedVocalRemovalInfo[]> {
  if (userId) {
    console.log(`🔍 查找用户 ${userId} 的逻辑删除人声移除记录...`);
  } else {
    console.log('🔍 查找所有逻辑删除的人声移除记录...');
  }

  // vocal_removals 表已移除 is_deleted 字段，使用物理删除
  // 因此不再有逻辑删除的记录需要清理
  console.log('📊 vocal_removals 表已使用物理删除，无需清理逻辑删除记录');
  return [];
}

/**
 * 获取所有关联到已删除记录的生成错误
 */
async function getDeletedGenerationErrors(userId?: string): Promise<DeletedGenerationErrorInfo[]> {
  if (userId) {
    console.log(`🔍 查找用户 ${userId} 关联到已删除记录的生成错误...`);
  } else {
    console.log('🔍 查找关联到已删除记录的生成错误...');
  }

  const query = userId
    ? `
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
        OR (ge.error_type = 'vocal_separation' AND vs.user_id = $1)
        OR ge.reference_id IS NULL)
      ORDER BY ge.created_at DESC
    `
    : `
      SELECT
        ge.id as error_id,
        ge.reference_id,
        ge.error_type,
        ge.created_at
      FROM generation_errors ge
      LEFT JOIN music mg ON ge.reference_id::text = mg.id::text AND ge.error_type = 'music_generation'
      LEFT JOIN vocal_separations vs ON ge.reference_id::text = vs.id::text AND ge.error_type = 'vocal_separation'
      WHERE
        (ge.error_type = 'music_generation')
        OR (ge.error_type = 'vocal_separation' AND vs.id IS NOT NULL)
        OR ge.reference_id IS NULL
      ORDER BY ge.created_at DESC
    `;

  const params = userId ? [userId] : undefined;
  const result = await dbQuery(query, params);

  console.log(`📊 找到 ${result.rows.length} 个关联到已删除记录的生成错误`);
  return result.rows;
}

/**
 * 获取所有关联到已删除音乐生成的歌词记录
 */
async function getDeletedLyrics(userId?: string): Promise<DeletedLyricsInfo[]> {
  if (userId) {
    console.log(`🔍 查找用户 ${userId} 关联到已删除音乐生成的歌词记录...`);
  } else {
    console.log('🔍 查找关联到已删除音乐生成的歌词记录...');
  }

  const query = userId
    ? `
      SELECT
        l.id as lyrics_id,
        l.music_id,
        l.title,
        l.created_at
      FROM lyrics l
      INNER JOIN music mg ON l.music_id = mg.id
      WHERE mg.user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM tracks
          WHERE music_id = mg.id
            AND (is_deleted IS NULL OR is_deleted = FALSE)
        )
      ORDER BY l.created_at DESC
    `
    : `
      SELECT
        l.id as lyrics_id,
        l.music_id,
        l.title,
        l.created_at
      FROM lyrics l
      INNER JOIN music mg ON l.music_id = mg.id
      WHERE NOT EXISTS (
        SELECT 1 FROM tracks
        WHERE music_id = mg.id
          AND (is_deleted IS NULL OR is_deleted = FALSE)
      )
      ORDER BY l.created_at DESC
    `;

  const params = userId ? [userId] : undefined;
  const result = await dbQuery(query, params);

  console.log(`📊 找到 ${result.rows.length} 个关联到已删除音乐生成的歌词记录`);
  return result.rows;
}

/**
 * 获取逻辑删除音轨关联的WAV转换记录
 */
async function getDeletedTrackWavConversions(trackIds: string[]): Promise<DeletedTrackWavInfo[]> {
  if (!trackIds || trackIds.length === 0) {
    console.log('✅ 没有需要处理的WAV转换记录');
    return [];
  }

  console.log('🔍 查找逻辑删除音轨的WAV转换记录...');

  const result = await dbQuery(
    `
      SELECT
        id as conversion_id,
        track_id,
        wav_url,
        wav_r2_url,
        status,
        updated_at
      FROM track_wav_conversions
      WHERE track_id = ANY($1)
    `,
    [trackIds]
  );

  console.log(`📊 找到 ${result.rows.length} 个关联的WAV转换记录`);
  return result.rows;
}

/**
 * 收集所有需要删除的R2文件
 */
async function collectR2FilesToDelete(
  tracks: DeletedTrackInfo[], 
  covers: DeletedCoverInfo[], 
  vocalSeparations: DeletedVocalSeparationInfo[],
  vocalRemovals: DeletedVocalRemovalInfo[],
  wavConversions: DeletedTrackWavInfo[]
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

    if (track.stream_audio_url) {
      const streamKey = extractR2KeyFromUrl(track.stream_audio_url);
      if (streamKey) {
        filesToDelete.push(streamKey);
        console.log(`  🔊 流式音频文件: ${streamKey} (track: ${track.track_id})`);
      }
    }
  }

  // 收集封面文件
  for (const cover of covers) {
    if (cover.cover_image_url) {
      const key = extractR2KeyFromUrl(cover.cover_image_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🖼️  封面文件: ${key} (track: ${cover.track_id})`);
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

  // 收集人声移除音频文件
  for (const removal of vocalRemovals) {
    // R2 持久化的人声音频文件（优先）
    if (removal.r2_vocal_url) {
      const key = extractR2KeyFromUrl(removal.r2_vocal_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎤 R2人声音频: ${key} (removal: ${removal.removal_id})`);
      }
    } else if (removal.vocal_url) {
      // 临时 URL
      const key = extractR2KeyFromUrl(removal.vocal_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎤 临时人声音频: ${key} (removal: ${removal.removal_id})`);
      }
    }

    // R2 持久化的伴奏音频文件（优先）
    if (removal.r2_instrumental_url) {
      const key = extractR2KeyFromUrl(removal.r2_instrumental_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎼 R2伴奏音频: ${key} (removal: ${removal.removal_id})`);
      }
    } else if (removal.instrumental_url) {
      // 临时 URL
      const key = extractR2KeyFromUrl(removal.instrumental_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎼 临时伴奏音频: ${key} (removal: ${removal.removal_id})`);
      }
    }
  }

  // 收集WAV转换文件
  for (const wav of wavConversions) {
    if (wav.wav_url) {
      const key = extractR2KeyFromUrl(wav.wav_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎧 WAV文件: ${key} (track: ${wav.track_id})`);
      }
    }
    if (wav.wav_r2_url) {
      const key = extractR2KeyFromUrl(wav.wav_r2_url);
      if (key) {
        filesToDelete.push(key);
        console.log(`  🎧 WAV R2文件: ${key} (track: ${wav.track_id})`);
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
async function generateDeletionSummary(userId?: string): Promise<DeletionSummary> {
  if (userId) {
    console.log(`\n📋 生成用户 ${userId} 的删除摘要...\n`);
  } else {
    console.log('\n📋 生成删除摘要...\n');
  }

  const tracks = await getDeletedTracksInfo(userId);
  const trackIds = tracks.map(track => track.track_id);
  const covers = await getOrphanedCovers(userId);
  const vocalSeparations = await getDeletedVocalSeparations();
  const vocalRemovals = await getDeletedVocalRemovals(userId);
  const generationErrors = await getDeletedGenerationErrors(userId);
  const lyrics = await getDeletedLyrics(userId);
  const wavConversions = await getDeletedTrackWavConversions(trackIds);
  const r2Files = await collectR2FilesToDelete(tracks, covers, vocalSeparations, vocalRemovals, wavConversions);
  const estimatedR2Size = await estimateR2FileSize(r2Files);

  return {
    tracks,
    covers,
    vocalSeparations,
    vocalRemovals,
    generationErrors,
    lyrics,
    wavConversions,
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
  vocalSeparationsDeleted: number;
  vocalRemovalsDeleted: number;
  generationErrorsDeleted: number;
  lyricsDeleted: number;
  wavConversionsDeleted: number;
}> {
  if (dryRun) {
    console.log('🔍 DRY RUN - 以下数据库记录将被删除（实际未删除）:');
    console.log(`  📀 音轨记录: ${summary.tracks.length} 个`);
    console.log(`  🖼️  封面记录: ${summary.covers.length} 个`);
    console.log(`  🎤 人声分离记录: ${summary.vocalSeparations.length} 个`);
    console.log(`  🎵 人声移除记录: ${summary.vocalRemovals.length} 个`);
    console.log(`  ❌ 生成错误记录: ${summary.generationErrors.length} 个`);
    console.log(`  📝 歌词记录: ${summary.lyrics.length} 个`);
     console.log(`  🎧 WAV转换记录: ${summary.wavConversions.length} 个`);
    return { 
      tracksDeleted: 0, 
      coversDeleted: 0, 
      generationsDeleted: 0,
      vocalSeparationsDeleted: 0,
      vocalRemovalsDeleted: 0,
      generationErrorsDeleted: 0,
      lyricsDeleted: 0,
      wavConversionsDeleted: 0
    };
  }

  console.log('🗑️  开始从数据库物理删除记录...');

  let tracksDeleted = 0;
  let coversDeleted = 0;
  let generationsDeleted = 0;
  let vocalSeparationsDeleted = 0;
  let vocalRemovalsDeleted = 0;
  let generationErrorsDeleted = 0;
  let lyricsDeleted = 0;
  let wavConversionsDeleted = 0;

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

    // 3. 删除歌词记录
    if (summary.lyrics.length > 0) {
      const lyricsIds = summary.lyrics.map(l => l.lyrics_id);
      const lyricsResult = await dbQuery(
        'DELETE FROM lyrics WHERE id = ANY($1) RETURNING id',
        [lyricsIds]
      );
      lyricsDeleted = lyricsResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${lyricsDeleted} 个歌词记录`);
    }

    // 4. 删除关联的WAV转换记录
    if (summary.wavConversions.length > 0) {
      const wavConversionIds = summary.wavConversions.map(w => w.conversion_id);
      const wavResult = await dbQuery(
        'DELETE FROM track_wav_conversions WHERE id = ANY($1) RETURNING id',
        [wavConversionIds]
      );
      wavConversionsDeleted = wavResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${wavConversionsDeleted} 个WAV转换记录`);
    }

    // 5. 删除音轨记录（包含封面图片URL）
    if (summary.tracks.length > 0) {
      const trackIds = summary.tracks.map(t => t.track_id);
      const trackResult = await dbQuery(
        'DELETE FROM tracks WHERE id = ANY($1) RETURNING id',
        [trackIds]
      );
      tracksDeleted = trackResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${tracksDeleted} 个音轨记录`);
    }

    // 6. 删除人声分离记录
    if (summary.vocalSeparations.length > 0) {
      const separationIds = summary.vocalSeparations.map(v => v.separation_id);
      const separationResult = await dbQuery(
        'DELETE FROM vocal_separations WHERE id = ANY($1) RETURNING id',
        [separationIds]
      );
      vocalSeparationsDeleted = separationResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${vocalSeparationsDeleted} 个人声分离记录`);
    }

    // 7. 删除人声移除记录
    if (summary.vocalRemovals.length > 0) {
      const removalIds = summary.vocalRemovals.map(v => v.removal_id);
      const removalResult = await dbQuery(
        'DELETE FROM vocal_removals WHERE id = ANY($1) RETURNING id',
        [removalIds]
      );
      vocalRemovalsDeleted = removalResult.rowCount || 0;
      console.log(`  ✅ 删除了 ${vocalRemovalsDeleted} 个人声移除记录`);
    }

    // 8. 删除没有关联音轨的生成记录
    const generationResult = await dbQuery(`
      DELETE FROM music
      WHERE NOT EXISTS (
        SELECT 1 FROM tracks
        WHERE music_id = music.id
          AND (is_deleted IS NULL OR is_deleted = FALSE)
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

  return { 
    tracksDeleted, 
    coversDeleted, 
    generationsDeleted,
    vocalSeparationsDeleted,
    vocalRemovalsDeleted,
    generationErrorsDeleted,
    lyricsDeleted,
    wavConversionsDeleted
  };
}

/**
 * 显示删除摘要
 */
function displayDeletionSummary(summary: DeletionSummary) {
  console.log('\n📊 删除摘要:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📀 逻辑删除的音轨: ${summary.tracks.length} 个`);
  console.log(`🖼️  孤立的封面图片: ${summary.covers.length} 个`);
  console.log(`🎤 逻辑删除的人声分离: ${summary.vocalSeparations.length} 个`);
  console.log(`🎵 逻辑删除的人声移除: ${summary.vocalRemovals.length} 个`);
  console.log(`❌ 关联的生成错误: ${summary.generationErrors.length} 个`);
  console.log(`📝 关联的歌词记录: ${summary.lyrics.length} 个`);
  console.log(`🎧 关联的WAV转换: ${summary.wavConversions.length} 个`);
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

  if (summary.vocalSeparations.length > 0) {
    console.log('\n🎤 人声分离详情 (前10个):');
    summary.vocalSeparations.slice(0, 10).forEach((separation, index) => {
      console.log(`  ${index + 1}. ${separation.separation_id}`);
      console.log(`     用户: ${separation.user_id}, 删除时间: ${separation.deleted_at}`);
    });
    if (summary.vocalSeparations.length > 10) {
      console.log(`     ... 还有 ${summary.vocalSeparations.length - 10} 个人声分离`);
    }
  }

  if (summary.vocalRemovals.length > 0) {
    console.log('\n🎵 人声移除详情 (前10个):');
    summary.vocalRemovals.slice(0, 10).forEach((removal, index) => {
      console.log(`  ${index + 1}. ${removal.removal_id}`);
      console.log(`     用户: ${removal.user_id}, 音轨: ${removal.track_id}, 删除时间: ${removal.deleted_at}`);
    });
    if (summary.vocalRemovals.length > 10) {
      console.log(`     ... 还有 ${summary.vocalRemovals.length - 10} 个人声移除`);
    }
  }

  if (summary.covers.length > 0) {
    console.log('\n🖼️  封面详情 (前10个):');
    summary.covers.slice(0, 10).forEach((cover, index) => {
      console.log(`  ${index + 1}. ${cover.track_id} (音乐ID: ${cover.music_id})`);
      console.log(`     封面URL: ${cover.cover_image_url?.substring(0, 80)}...`);
    });
    if (summary.covers.length > 10) {
      console.log(`     ... 还有 ${summary.covers.length - 10} 个封面`);
    }
  }

  if (summary.generationErrors.length > 0) {
    console.log('\n❌ 生成错误详情 (前10个):');
    summary.generationErrors.slice(0, 10).forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.error_type} - ${error.reference_id}`);
    });
    if (summary.generationErrors.length > 10) {
      console.log(`     ... 还有 ${summary.generationErrors.length - 10} 个错误`);
    }
  }

  if (summary.lyrics.length > 0) {
    console.log('\n📝 歌词详情 (前10个):');
    summary.lyrics.slice(0, 10).forEach((lyric, index) => {
      console.log(`  ${index + 1}. ${lyric.title || 'Unknown'} (${lyric.lyrics_id})`);
    });
    if (summary.lyrics.length > 10) {
      console.log(`     ... 还有 ${summary.lyrics.length - 10} 个歌词`);
    }
  }

  if (summary.wavConversions.length > 0) {
    console.log('\n🎧 WAV转换详情 (前10个):');
    summary.wavConversions.slice(0, 10).forEach((wav, index) => {
      console.log(`  ${index + 1}. 转换ID: ${wav.conversion_id} (track: ${wav.track_id})`);
      if (wav.status) {
        console.log(`     状态: ${wav.status}, 更新时间: ${wav.updated_at}`);
      }
    });
    if (summary.wavConversions.length > 10) {
      console.log(`     ... 还有 ${summary.wavConversions.length - 10} 个WAV转换记录`);
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
    
    // 提取用户ID参数
    const userIdArg = args.find(arg => arg.startsWith('--user='));
    const userId = userIdArg ? userIdArg.split('=')[1] : undefined;

    if (userId) {
      console.log(`🎯 目标用户: ${userId}`);
    }

    if (dryRun) {
      console.log('ℹ️  运行在 DRY RUN 模式，不会实际删除任何数据');
      console.log('💡 要实际删除，请使用: --delete');
      console.log('💡 只删除数据库: --delete --skip-r2');
      console.log('💡 只删除R2文件: --delete --skip-db');
      console.log('💡 指定用户: --user=USER_ID');
      console.log('💡 示例: --delete --user=94082d03-00cd-4ce0-b7da-ce411e4af948\n');
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
    const summary = await generateDeletionSummary(userId);

    // 显示摘要
    displayDeletionSummary(summary);

    // 如果没有需要删除的数据，退出
    if (summary.tracks.length === 0 && summary.covers.length === 0 && 
        summary.vocalSeparations.length === 0 && summary.vocalRemovals.length === 0 && 
        summary.generationErrors.length === 0 && summary.lyrics.length === 0 &&
        summary.wavConversions.length === 0) {
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

    let dbResults = { 
      tracksDeleted: 0, 
      coversDeleted: 0, 
      generationsDeleted: 0,
      vocalSeparationsDeleted: 0,
      vocalRemovalsDeleted: 0,
      generationErrorsDeleted: 0,
      lyricsDeleted: 0,
      wavConversionsDeleted: 0
    };
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
    console.log(`  🎤 人声分离记录: ${dbResults.vocalSeparationsDeleted} 个`);
    console.log(`  🎵 人声移除记录: ${dbResults.vocalRemovalsDeleted} 个`);
    console.log(`  ❌ 生成错误记录: ${dbResults.generationErrorsDeleted} 个`);
    console.log(`  📝 歌词记录: ${dbResults.lyricsDeleted} 个`);
    console.log(`  🎧 WAV转换记录: ${dbResults.wavConversionsDeleted} 个`);
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
  getDeletedVocalSeparations,
  getDeletedVocalRemovals,
  getDeletedGenerationErrors,
  getDeletedLyrics,
  getDeletedTrackWavConversions,
  collectR2FilesToDelete,
  physicallyDeleteFromDatabase,
  deleteR2Files
};
