/**
 * 音乐扩展数据库操作
 */

import { query } from '@/lib/db-query-builder';
import { ExtensionInfo, ExtensionHistory } from '@/features/music-upload/types/extend-music';
import { MusicType } from '@/types/music';

/**
 * 创建扩展音乐任务记录
 */
export async function createExtendMusicTask(params: {
  userId: string;
  taskId: string;
  title: string;
  tags: string;
  prompt: string;
  generationMode?: string;
  isInstrumental: boolean;
  originalMusicId: string;
  originalTrackId: string; // 保留参数以保持 API 兼容性，但不存储到 music 表
  type?: MusicType;
  model?: string;
}): Promise<string> {
  const {
    userId,
    taskId,
    title,
    tags,
    prompt,
    generationMode,
    isInstrumental,
    originalMusicId,
    type = 'extended',
    model = 'V4',
    // originalTrackId 不再存储到 music 表，而是在创建 track 时存储到 tracks 表
  } = params;

  const normalizedType: MusicType = type || 'extended';

  const result = await query(
    `INSERT INTO music (
      user_id,
      task_id,
      title,
      tags,
      prompt,
      generation_mode,
      is_instrumental,
      status,
      original_music_id,
      type,
      model,
      created_at,
      updated_at
    ) VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      'generating',
      $8::uuid,
      $9,
      $10,
      NOW(),
      NOW()
    ) RETURNING id`,
    [
      userId,
      taskId,
      title,
      tags,
      prompt,
      generationMode || null,
      isInstrumental,
      originalMusicId,
      normalizedType,
      model,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create extend music task');
  }

  return result.rows[0].id;
}

/**
 * 更新扩展音乐任务状态
 * 注意：status 值必须符合数据库约束：'generating' | 'text' | 'first' | 'complete' | 'error'
 */
export async function updateExtendMusicTaskStatus(
  taskId: string,
  status: 'generating' | 'complete' | 'error'
): Promise<void> {
  await query(
    `UPDATE music 
     SET status = $1, updated_at = NOW()
     WHERE task_id = $2`,
    [status, taskId]
  );
}

/**
 * 获取扩展信息
 */
export async function getExtensionInfo(musicId: string): Promise<ExtensionInfo | null> {
  const result = await query(
    `SELECT
      m.type,
      m.original_music_id,
      t.original_track_id,
      om.title as original_music_title,
      COALESCE(ot.title, om.title) as original_track_title
    FROM music m
    LEFT JOIN music om ON m.original_music_id = om.id
    LEFT JOIN tracks t ON t.music_id = m.id AND m.type IN ('extended', 'upload_extend')
    LEFT JOIN tracks ot ON t.original_track_id = ot.id
    WHERE m.id = $1::uuid
    LIMIT 1`,
    [musicId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  const musicType: MusicType = row.type || 'generated';
  const isExtension = musicType === 'extended' || musicType === 'upload_extend';

  if (!isExtension) {
    return {
      isExtension: false,
    };
  }

  return {
    isExtension: true,
    originalMusicId: row.original_music_id,
    originalTrackId: row.original_track_id,
    originalTrackTitle: row.original_track_title,
  };
}

/**
 * 获取扩展链（从当前 music 回溯到原始 music）
 */
export async function getExtensionChain(musicId: string): Promise<ExtensionInfo | null> {
  const result = await query(
    `SELECT * FROM get_extension_chain($1::uuid)`,
    [musicId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const chain = result.rows.map((row: any) => ({
    musicId: row.music_id,
    title: row.title,
    createdAt: row.created_at,
  }));

  const original = chain[0];

  return {
    isExtension: chain.length > 1,
    originalMusicId: original.musicId,
    originalTrackId: undefined, // 需要从原始 music 中查询
    originalTrackTitle: original.title,
    extensionChain: chain,
  };
}

/**
 * 获取扩展历史（某个 music 的所有扩展版本）
 */
export async function getExtensionHistory(musicId: string): Promise<ExtensionHistory> {
  const result = await query(
    `SELECT 
      ae.extension_music_id as id,
      ae.extension_title as title,
      ae.extension_created_at as created_at,
      COUNT(t.id) as track_count
    FROM get_all_extensions($1::uuid) ae
    LEFT JOIN tracks t ON ae.extension_music_id = t.music_id
      AND (t.is_deleted IS NULL OR t.is_deleted = FALSE)
    GROUP BY ae.extension_music_id, ae.extension_title, ae.extension_created_at
    ORDER BY ae.extension_created_at ASC`,
    [musicId]
  );

  return {
    extensions: result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      trackCount: parseInt(row.track_count || '0'),
    })),
  };
}

/**
 * 根据 task_id 查询 music_id
 */
export async function getMusicIdByTaskId(taskId: string): Promise<string | null> {
  const result = await query(
    `SELECT id FROM music WHERE task_id = $1 LIMIT 1`,
    [taskId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].id;
}

/**
 * 获取原始 track 信息（用于扩展）
 */
export async function getOriginalTrackInfo(trackId: string): Promise<{
  musicId: string;
  trackId: string;
  sunoTrackId: string;
  title: string;
  genre: string;
  tags: string;
  audioUrl: string;
  duration: number;
  isInstrumental: boolean;
  style?: string;
  taskId?: string; // 原音乐的 taskId
} | null> {
  const result = await query(
    `SELECT 
      mt.id as track_id,
      mt.suno_track_id,
      mt.audio_url,
      mt.duration,
      mg.id as music_id,
      mg.task_id,
      COALESCE(mt.title, mg.title) as title,
      COALESCE(NULLIF(mg.tags, ''), '') as genre,
      mg.tags,
      mg.is_instrumental,
      mg.tags as style
    FROM tracks mt
    INNER JOIN music mg ON mt.music_id = mg.id
    WHERE mt.id = $1::uuid
      AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
    LIMIT 1`,
    [trackId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    musicId: row.music_id,
    trackId: row.track_id,
    sunoTrackId: row.suno_track_id,
    title: row.title,
    genre: row.genre,
    tags: row.tags,
    audioUrl: row.audio_url,
    duration: row.duration,
    isInstrumental: row.is_instrumental,
    style: row.style,
    taskId: row.task_id,
  };
}

/**
 * 创建扩展的 track 记录
 */
export async function createExtendedTrack(params: {
  musicId: string;
  sunoTrackId: string;
  title?: string;
  audioUrl: string;
  streamAudioUrl?: string;
  duration: number;
  coverImageUrl?: string;
  originalTrackId?: string;
  sourceType?: 'extended' | 'replace_section';
}): Promise<string> {
  const {
    musicId,
    sunoTrackId,
    title,
    audioUrl,
    streamAudioUrl,
    duration,
    coverImageUrl,
    originalTrackId,
    sourceType = 'extended',
  } = params;

  const result = await query(
    `INSERT INTO tracks (
      music_id,
      suno_track_id,
      title,
      audio_url,
      stream_audio_url,
      duration,
      cover_image_url,
      original_track_id,
      source_type,
      created_at,
      updated_at
    ) VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::uuid,
      $9,
      NOW(),
      NOW()
    ) RETURNING id`,
    [
      musicId,
      sunoTrackId,
      title,
      audioUrl,
      streamAudioUrl,
      duration,
      coverImageUrl,
      originalTrackId || null,
      sourceType,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create extended track');
  }

  return result.rows[0].id;
}
