import { query, withTransaction } from './db-query-builder';
import { validateRequiredParams, buildUpdateClause } from './db-utils';
import { checkMultipleFavorites } from './favorites-db';
import { LibraryTrack } from '@/types/track';
import { MusicType } from '@/types/music';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface MusicGeneration {
  id: string;
  user_id: string;
  author_name?: string;
  title?: string;
  genre?: string;
  tags?: string;
  prompt?: string;
  generation_mode?: string;
  is_instrumental: boolean;
  task_id?: string;
  status?: 'generating' | 'text' | 'first' | 'complete' | 'error';
  model?: string;
  created_at: string;
  updated_at: string;
  type: MusicType;
}

export interface CreateMusicGenerationData {
  author_name?: string;
  title?: string;
  tags?: string;
  prompt?: string;
  generation_mode?: string;
  is_instrumental?: boolean;
  task_id?: string;
  status?: 'generating' | 'complete' | 'error' | 'text';
  type?: MusicType;
  model?: string;
}

export interface MusicGenerationWithTracks {
  id: string;
  title?: string;
  genre?: string;
  tags?: string;
  prompt?: string;
  generation_mode?: string;
  is_instrumental: boolean;
  status?: string;
  model?: string;
  created_at: string;
  updated_at: string;
  lyrics_content?: string;
  allTracks: LibraryTrack[];
  totalDuration: number;
  errorInfo?: any;
  type?: MusicType;
}

type MusicGenerationStatus = NonNullable<MusicGeneration['status']>;

const TERMINAL_MUSIC_STATUSES = new Set<MusicGenerationStatus>(['complete']);

function canTransitionMusicStatus(current: string | null | undefined, target: MusicGenerationStatus): boolean {
  const currentStatus = (current || 'generating') as MusicGenerationStatus;
  if (currentStatus === target) {
    return true;
  }

  // Keep terminal states immutable to avoid callback disorder regressing or flipping final results.
  if (TERMINAL_MUSIC_STATUSES.has(currentStatus)) {
    return false;
  }

  if (currentStatus === 'error') {
    return target === 'error' || target === 'complete';
  }

  if (target === 'error') {
    return true;
  }

  if (target === 'text') {
    return currentStatus === 'generating';
  }

  if (target === 'first') {
    return currentStatus === 'generating' || currentStatus === 'text';
  }

  if (target === 'complete') {
    return currentStatus === 'generating' || currentStatus === 'text' || currentStatus === 'first';
  }

  return false;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new music generation record
 */
export const createMusicGeneration = async (
  userId: string,
  data: CreateMusicGenerationData
): Promise<MusicGeneration> => {
  try {
    validateRequiredParams({ userId }, ['userId']);

    const tooLongFields: string[] = [];
    const lengthSnapshot: Record<string, number> = {};
    const checkLength = (field: string, value: string | null | undefined, maxLength: number) => {
      if (typeof value !== 'string') return;
      lengthSnapshot[field] = value.length;
      if (value.length > maxLength) {
        tooLongFields.push(`${field}(${value.length})`);
      }
    };

    checkLength('title', data.title ?? null, 255);
    checkLength('author_name', data.author_name ?? null, 255);
    checkLength('task_id', data.task_id ?? null, 255);
    checkLength('generation_mode', data.generation_mode ?? null, 20);
    checkLength('status', data.status ?? null, 20);
    checkLength('type', data.type ?? null, 50);
    checkLength('model', data.model ?? null, 20);

    if (tooLongFields.length > 0) {
      const message = `Music insert fields too long: ${tooLongFields.join(', ')}`;
      console.error(message, { lengthSnapshot });
      throw new Error(message);
    }

    const result = await query(
      `INSERT INTO music (
        user_id, author_name, title, tags, prompt, generation_mode,
        is_instrumental, task_id, status, type, model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        data.author_name || null,
        data.title || null,
        data.tags || null,
        data.prompt || null,
        data.generation_mode || null,
        data.is_instrumental || false,
        data.task_id || null,
        data.status || 'generating',
        data.type || 'generated',
        data.model || 'V4'
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating music generation:', error);
    throw error;
  }
};

/**
 * Soft deletes a music generation record and all associated tracks
 */
export const softDeleteMusicGeneration = async (generationId: string, userId: string): Promise<boolean> => {
  try {
    validateRequiredParams({ generationId, userId }, ['generationId', 'userId']);

    return await withTransaction(async (queryFn) => {
      // 1. Verify music generation exists and belongs to user
      const generationResult = await queryFn(
        `SELECT id FROM music
         WHERE id = $1 AND user_id = $2::uuid
         RETURNING id`,
        [generationId, userId]
      );

      if (generationResult.rows.length === 0) {
        return false;
      }

      // 2. Soft delete all associated tracks records
      await queryFn(
        `UPDATE tracks
         SET is_deleted = TRUE, updated_at = NOW()
         WHERE music_id = $1 AND (is_deleted IS NULL OR is_deleted = FALSE)
         RETURNING id`,
        [generationId]
      );

      return true;
    });
  } catch (error) {
    console.error('Error soft deleting music generation:', error);
    throw error;
  }
};

/**
 * Soft deletes a single music track record
 */
export const softDeleteMusicTrack = async (trackId: string, userId: string): Promise<boolean> => {
  try {
    validateRequiredParams({ trackId, userId }, ['trackId', 'userId']);

    // Verify user owns the track and soft delete it
    const result = await query(
      `UPDATE tracks
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE id = $1
         AND music_id IN (
           SELECT id FROM music WHERE user_id = $2::uuid
         )
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING id`,
      [trackId, userId]
    );


    return result.rows.length > 0;
  } catch (error) {
    console.error('Error soft deleting music track:', error);
    throw error;
  }
};

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Gets paginated generation IDs for a user
 */
const getUserGenerationIds = async (userId: string, limit: number, offset: number): Promise<string[]> => {
  const result = await query(`
    SELECT id
    FROM music
    WHERE user_id = $1::uuid AND is_deleted = FALSE
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows.map(row => row.id);
};

/**
 * Gets detailed generation data with tracks and lyrics
 */
const getGenerationsWithDetails = async (generationIds: string[]): Promise<any[]> => {
  const result = await query(`
    SELECT
      mg.id as generation_id,
      mg.title,
      COALESCE(NULLIF(mg.tags, ''), '') as genre,
      mg.tags,
      mg.prompt,
      mg.is_instrumental,
      mg.status,
      mg.model,
      mg.created_at as generation_created_at,
      mg.updated_at as generation_updated_at,
      ml.content as lyrics_content,
      mt.id as track_id,
      mt.suno_track_id,
      mt.audio_url,
      mt.duration,
      mt.is_published,
      mt.is_pinned,
      mt.created_at as track_created_at,
      mt.updated_at as track_updated_at,
      mt.cover_image_url as cover_r2_url
    FROM music mg
    LEFT JOIN lyrics ml ON mg.id = ml.music_id
    LEFT JOIN tracks mt ON mg.id = mt.music_id
      AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
    WHERE mg.id = ANY($1)
    ORDER BY mg.created_at DESC, mt.created_at ASC
  `, [generationIds]);

  return result.rows;
};

/**
 * Groups database rows by generation_id and processes track data
 */
const processGenerationRows = (rows: any[]): MusicGenerationWithTracks[] => {
  const generationsMap = new Map<string, MusicGenerationWithTracks>();

  for (const row of rows) {
    const generationId = row.generation_id;

    if (!generationsMap.has(generationId)) {
      generationsMap.set(generationId, {
        id: generationId,
        title: row.title,
        genre: row.genre,
        tags: row.tags,
        prompt: row.prompt,
        is_instrumental: row.is_instrumental,
        status: row.status,
        model: row.model,
        created_at: row.generation_created_at,
        updated_at: row.generation_updated_at,
        lyrics_content: row.lyrics_content,
        allTracks: [],
        totalDuration: 0
      });
    }

    // Add track data if exists
    if (row.track_id) {
      const track = {
        id: row.track_id,
        audioUrl: row.audio_url, // 映射数据库字段为 JavaScript 字段名
        duration: typeof row.duration === 'string' ? parseFloat(row.duration) : (row.duration || 0),
        coverR2Url: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
        lyrics: row.lyrics_content || '',
        isDeleted: false, // 映射数据库字段为 JavaScript 字段名
        isFavorited: false // 映射数据库字段为 JavaScript 字段名
      };

      generationsMap.get(generationId)!.allTracks.push(track as any);

      // Calculate total duration
      const duration = typeof row.duration === 'string' ? parseFloat(row.duration) : (row.duration || 0);
      generationsMap.get(generationId)!.totalDuration += duration;
    }
  }

  return Array.from(generationsMap.values());
};

/**
 * Adds error information to generations with error status
 */
const addErrorInfoToGenerations = async (musicGenerations: MusicGenerationWithTracks[]): Promise<void> => {
  const errorGenerationIds = musicGenerations
    .filter(gen => gen.status === 'error')
    .map(gen => gen.id);

  if (errorGenerationIds.length > 0) {
    try {
      const errorInfoResult = await query(`
        SELECT reference_id, error_message, error_details, created_at
        FROM generation_errors
        WHERE reference_id = ANY($1)
        ORDER BY created_at DESC
      `, [errorGenerationIds]);

      // Map error information to corresponding generation
      const errorInfoMap = new Map();
      errorInfoResult.rows.forEach(error => {
        if (!errorInfoMap.has(error.reference_id)) {
          errorInfoMap.set(error.reference_id, error);
        }
      });

      musicGenerations.forEach(generation => {
        if (generation.status === 'error') {
          generation.errorInfo = errorInfoMap.get(generation.id) || null;
        }
      });
    } catch (error) {
      console.error('Failed to get error info for generations:', error);
    }
  }
};

/**
 * Adds favorite status information to tracks if requestUserId is provided
 */
const addFavoriteStatusToTracks = async (musicGenerations: MusicGenerationWithTracks[], requestUserId?: string): Promise<void> => {
  if (!requestUserId) return;

  // Collect all track IDs
  const allTrackIds: string[] = [];
  musicGenerations.forEach(generation => {
    generation.allTracks.forEach((track: any) => {
      allTrackIds.push(track.id);
    });
  });

  // Batch check favorite status
  if (allTrackIds.length > 0) {
    try {
      const favoriteStatus = await checkMultipleFavorites(requestUserId, allTrackIds);

      // Add favorite status to each track
      musicGenerations.forEach(generation => {
        generation.allTracks.forEach((track: any) => {
          track.isFavorited = favoriteStatus[track.id] || false; // 映射数据库字段为 JavaScript 字段名
          // isPinned and isPublished are directly from database fields (mapped in query results)
        });
      });
    } catch (error) {
      console.error('Error checking favorite status:', error);
      // Continue returning data without status information if check fails
    }
  }
};

/**
 * Gets user's music generations (grouped by music, including all tracks)
 */
export const getUserMusicGenerations = async (
  userId: string,
  limit: number = 10,
  offset: number = 0,
  requestUserId?: string
): Promise<MusicGenerationWithTracks[]> => {
  try {
    validateRequiredParams({ userId }, ['userId']);

    // Get paginated generation IDs
    const generationIds = await getUserGenerationIds(userId, limit, offset);

    if (generationIds.length === 0) {
      return [];
    }

    // Get detailed generation data
    const rows = await getGenerationsWithDetails(generationIds);

    // Process and group the data
    const musicGenerations = processGenerationRows(rows);

    // Add error information for failed generations
    await addErrorInfoToGenerations(musicGenerations);

    // Add favorite status if requested
    await addFavoriteStatusToTracks(musicGenerations, requestUserId);

    return musicGenerations;
  } catch (error) {
    console.error('Error getting user music generations:', error);
    throw error;
  }
};

/**
 * Gets public music generation records
 */
export const getPublicMusicGenerations = async (limit: number = 10, offset: number = 0): Promise<MusicGeneration[]> => {
  try {
    const result = await query(
      'SELECT * FROM music ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting public music generations:', error);
    throw error;
  }
};

/**
 * Finds music generation record by task_id
 */
export const getMusicGenerationByTaskId = async (taskId: string): Promise<MusicGeneration | null> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const result = await query(
      'SELECT * FROM music WHERE task_id = $1',
      [taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting music generation by task_id:', error);
    throw error;
  }
};

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Updates music generation record by task_id
 */
export const updateMusicGenerationByTaskId = async (
  taskId: string,
  data: Partial<MusicGeneration>
): Promise<MusicGeneration> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const excludeFields = ['id', 'user_id', 'created_at', 'task_id'];
    const { setClause, values } = buildUpdateClause(data, excludeFields);

    const result = await query(
      `UPDATE music SET ${setClause}, updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId, ...values]
    );

    if (result.rows.length === 0) {
      throw new Error('Music generation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating music generation by task_id:', error);
    throw error;
  }
};

/**
 * Updates music status by task_id with forward-only transition guard.
 * Returns the current row when transition is blocked, without mutating data.
 */
export const transitionMusicGenerationStatusByTaskId = async (
  taskId: string,
  targetStatus: MusicGenerationStatus,
  patch: Partial<MusicGeneration> = {}
): Promise<{ updated: boolean; record: MusicGeneration }> => {
  try {
    validateRequiredParams({ taskId, targetStatus }, ['taskId', 'targetStatus']);

    const existingResult = await query(
      'SELECT * FROM music WHERE task_id = $1 LIMIT 1',
      [taskId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error('Music generation not found');
    }

    const currentRecord = existingResult.rows[0] as MusicGeneration;
    const currentStatus = currentRecord.status || 'generating';

    if (!canTransitionMusicStatus(currentStatus, targetStatus)) {
      return {
        updated: false,
        record: currentRecord,
      };
    }

    const data: Partial<MusicGeneration> = {
      ...patch,
      status: targetStatus,
    };

    const excludeFields = ['id', 'user_id', 'created_at', 'task_id'];
    const { setClause, values } = buildUpdateClause(data, excludeFields);
    if (!setClause) {
      return {
        updated: false,
        record: currentRecord,
      };
    }

    const updatedResult = await query(
      `UPDATE music SET ${setClause}, updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId, ...values]
    );

    if (updatedResult.rows.length === 0) {
      throw new Error('Music generation not found');
    }

    return {
      updated: true,
      record: updatedResult.rows[0] as MusicGeneration,
    };
  } catch (error) {
    console.error('Error transitioning music generation status by task_id:', error);
    throw error;
  }
};

/**
 * Updates music generation record by id
 */
export const updateMusicGeneration = async (
  id: string,
  data: Partial<MusicGeneration>
): Promise<MusicGeneration> => {
  try {
    validateRequiredParams({ id }, ['id']);

    const excludeFields = ['id', 'user_id', 'created_at'];
    const { setClause, values } = buildUpdateClause(data, excludeFields);

    const result = await query(
      `UPDATE music SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      throw new Error('Music generation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating music generation:', error);
    throw error;
  }
};

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

/**
 * Hard deletes a music generation record
 */
export const deleteMusicGeneration = async (id: string, userId: string): Promise<boolean> => {
  try {
    validateRequiredParams({ id, userId }, ['id', 'userId']);

    const result = await query(
      'DELETE FROM music WHERE id = $1 AND user_id = $2::uuid',
      [id, userId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error deleting music generation:', error);
    throw error;
  }
};

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Gets all audio URLs from database (used for cleanup scripts)
 */
export const getAllAudioUrls = async (): Promise<string[]> => {
  try {
    const result = await query(`
      SELECT audio_url
      FROM tracks
      WHERE audio_url IS NOT NULL
        AND audio_url != ''
        AND (is_deleted IS NULL OR is_deleted = FALSE)
    `);

    return result.rows.map(row => row.audio_url).filter(url => url);
  } catch (error) {
    console.error('Error getting all audio URLs:', error);
    throw error;
  }
};

/**
 * Fixes music generations that have null titles by copying from lyrics
 */
export const fixMissingTitlesFromLyrics = async (): Promise<{ updated: number; errors: string[] }> => {
  try {
    const errors: string[] = [];
    let updated = 0;

    // Find music with null titles that have corresponding lyrics with titles
    const result = await query(`
      SELECT
        mg.id as generation_id,
        mg.title as current_title,
        ml.title as lyrics_title
      FROM music mg
      INNER JOIN lyrics ml ON mg.id = ml.music_id
      WHERE (mg.title IS NULL OR mg.title = '')
        AND ml.title IS NOT NULL
        AND ml.title != ''
        AND ml.title != 'Generated Lyrics'
    `);


    for (const row of result.rows) {
      try {
        await query(
          `UPDATE music
           SET title = $1, updated_at = NOW()
           WHERE id = $2`,
          [row.lyrics_title, row.generation_id]
        );

        updated++;
      } catch (error) {
        const errorMsg = `Failed to update generation ${row.generation_id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return { updated, errors };
  } catch (error) {
    console.error('Error fixing missing titles:', error);
    throw error;
  }
};
