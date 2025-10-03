import { query, withTransaction } from './db-query-builder';
import { checkMultipleFavorites } from './favorites-db';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface MusicGeneration {
  id: string;
  user_id: string;
  title?: string;
  genre?: string;
  tags?: string;
  prompt?: string;
  is_instrumental: boolean;
  task_id?: string;
  status?: 'generating' | 'text' | 'first' | 'complete' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreateMusicGenerationData {
  title?: string;
  genre?: string;
  tags?: string;
  prompt?: string;
  is_instrumental?: boolean;
  task_id?: string;
  status?: 'generating' | 'complete' | 'error' | 'text';
}

export interface MusicGenerationWithTracks {
  id: string;
  title?: string;
  genre?: string;
  tags?: string;
  prompt?: string;
  is_instrumental: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
  lyrics_content?: string;
  allTracks: any[];
  totalDuration: number;
  errorInfo?: any;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates required parameters for database operations
 */
const validateRequiredParams = (params: Record<string, any>, requiredFields: string[]): void => {
  for (const field of requiredFields) {
    if (!params[field]) {
      throw new Error(`Missing required parameter: ${field}`);
    }
  }
};

/**
 * Builds dynamic UPDATE SQL clause from data object
 */
const buildUpdateClause = (data: Record<string, any>, excludeFields: string[] = []): { setClause: string; values: any[] } => {
  const fields = Object.keys(data).filter(key => !excludeFields.includes(key));
  const setClause = fields.map(field => `${field} = $${fields.indexOf(field) + 2}`).join(', ');
  const values = fields.map(field => data[field]);

  return { setClause, values };
};

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

    const result = await query(
      `INSERT INTO music_generations (
        user_id, title, genre, tags, prompt,
        is_instrumental, task_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        data.title || null,
        data.genre || null,
        data.tags || null,
        data.prompt || null,
        data.is_instrumental || false,
        data.task_id || null,
        data.status || 'generating'
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
      // 1. Soft delete music_generation record
      const generationResult = await queryFn(
        `UPDATE music_generations
         SET is_deleted = TRUE, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE
         RETURNING id`,
        [generationId, userId]
      );


      if (generationResult.rows.length === 0) {
        return false;
      }

      // 2. Soft delete all associated music_tracks records
      const tracksResult = await queryFn(
        `UPDATE music_tracks
         SET is_deleted = TRUE, updated_at = NOW()
         WHERE music_generation_id = $1 AND (is_deleted IS NULL OR is_deleted = FALSE)
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
      `UPDATE music_tracks
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE id = $1
         AND music_generation_id IN (
           SELECT id FROM music_generations WHERE user_id = $2
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
    FROM music_generations
    WHERE user_id = $1 AND is_deleted = FALSE
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
      mg.genre,
      mg.tags,
      mg.prompt,
      mg.is_instrumental,
      mg.status,
      mg.created_at as generation_created_at,
      mg.updated_at as generation_updated_at,
      ml.content as lyrics_content,
      mt.id as track_id,
      mt.suno_track_id,
      mt.audio_url,
      mt.duration,
      mt.side_letter,
      mt.is_published,
      mt.is_pinned,
      mt.created_at as track_created_at,
      mt.updated_at as track_updated_at,
      ci.r2_url as cover_r2_url
    FROM music_generations mg
    LEFT JOIN music_lyrics ml ON mg.id = ml.music_generation_id
    LEFT JOIN music_tracks mt ON mg.id = mt.music_generation_id
      AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
    LEFT JOIN LATERAL (
      SELECT ci.r2_url
      FROM cover_images ci
      WHERE ci.music_track_id = mt.id
      ORDER BY ci.created_at ASC
      LIMIT 1
    ) ci ON true
    WHERE mg.id = ANY($1)
    ORDER BY mg.created_at DESC, mt.side_letter ASC
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
        suno_track_id: row.suno_track_id,
        audio_url: row.audio_url,
        duration: row.duration,
        side_letter: row.side_letter,
        is_published: row.is_published,
        is_pinned: row.is_pinned,
        created_at: row.track_created_at,
        updated_at: row.track_updated_at,
        cover_r2_url: row.cover_r2_url,
        lyrics: row.lyrics_content || ''
      };

      generationsMap.get(generationId)!.allTracks.push(track);

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
        WHERE reference_type = 'music_generation'
          AND reference_id = ANY($1)
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
          track.is_favorited = favoriteStatus[track.id] || false;
          // is_pinned and is_published are directly from database fields
        });
      });
    } catch (error) {
      console.error('Error checking favorite status:', error);
      // Continue returning data without status information if check fails
    }
  }
};

/**
 * Gets user's music generations (grouped by music_generations, including all tracks)
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
      'SELECT * FROM music_generations ORDER BY created_at DESC LIMIT $1 OFFSET $2',
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
      'SELECT * FROM music_generations WHERE task_id = $1',
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
      `UPDATE music_generations SET ${setClause}, updated_at = NOW() WHERE task_id = $1 RETURNING *`,
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
      `UPDATE music_generations SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
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
      'DELETE FROM music_generations WHERE id = $1 AND user_id = $2',
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
      FROM music_tracks
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
 * Fixes music generations that have null titles by copying from music_lyrics
 */
export const fixMissingTitlesFromLyrics = async (): Promise<{ updated: number; errors: string[] }> => {
  try {
    const errors: string[] = [];
    let updated = 0;

    // Find music_generations with null titles that have corresponding lyrics with titles
    const result = await query(`
      SELECT
        mg.id as generation_id,
        mg.title as current_title,
        ml.title as lyrics_title
      FROM music_generations mg
      INNER JOIN music_lyrics ml ON mg.id = ml.music_generation_id
      WHERE (mg.title IS NULL OR mg.title = '')
        AND ml.title IS NOT NULL
        AND ml.title != ''
        AND ml.title != 'Generated Lyrics'
    `);


    for (const row of result.rows) {
      try {
        await query(
          `UPDATE music_generations
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
