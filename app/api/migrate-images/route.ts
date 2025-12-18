/**
 * API Endpoint for Historical Image Migration
 *
 * This endpoint allows running the image migration from the browser,
 * avoiding local sharp platform compatibility issues.
 *
 * Usage:
 * - GET /api/migrate-images?preview=true&limit=10 - Preview mode
 * - POST /api/migrate-images - Execute migration
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-pool';
import { downloadFromUrl, uploadCoverImageWithVersions, extractKeyFromR2Url } from '@/lib/r2-storage';
import { compressImageForThumbnail, getOptimizedFilename } from '@/lib/image-optimization';

const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || '';

interface Track {
  id: string;
  cover_image_url: string;
  cover_original_url: string | null;
  music_id: string;
}

interface MigrationStats {
  total: number;
  alreadyMigrated: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// Simple authentication - you can enhance this
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.MIGRATION_API_TOKEN || 'makernb-migration-2024';

  return authHeader === `Bearer ${expectedToken}`;
}

export async function GET(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
  const preview = searchParams.get('preview') === 'true';

  try {
    const result = await query<Track>(`
      SELECT
        t.id,
        t.cover_image_url,
        t.cover_original_url,
        t.music_id
      FROM tracks t
      WHERE t.cover_image_url IS NOT NULL
        AND t.cover_image_url != ''
        AND (t.is_deleted IS NULL OR t.is_deleted = false)
      ORDER BY t.created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `);

    const tracks = result.rows;
    const stats = {
      total: tracks.length,
      alreadyMigrated: 0,
      needsMigration: 0,
    };

    const needsMigration: Track[] = [];
    const alreadyMigrated: Track[] = [];

    for (const track of tracks) {
      if (track.cover_original_url && track.cover_image_url.includes('thumbnail_')) {
        alreadyMigrated.push(track);
        stats.alreadyMigrated++;
      } else {
        needsMigration.push(track);
        stats.needsMigration++;
      }
    }

    return NextResponse.json({
      success: true,
      preview: true,
      stats,
      needsMigration: needsMigration.map(t => ({
        id: t.id,
        cover_image_url: t.cover_image_url,
      })),
    });
  } catch (error) {
    console.error('[Migration API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const limit = body.limit as number | undefined;
  const batchSize = body.batchSize || 5;

  const stats: MigrationStats = {
    total: 0,
    alreadyMigrated: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Fetch tracks that need migration
    const result = await query<Track>(`
      SELECT
        t.id,
        t.cover_image_url,
        t.cover_original_url,
        t.music_id
      FROM tracks t
      WHERE t.cover_image_url IS NOT NULL
        AND t.cover_image_url != ''
        AND (t.is_deleted IS NULL OR t.is_deleted = false)
      ORDER BY t.created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `);

    const tracks = result.rows;
    stats.total = tracks.length;

    // Filter tracks that need migration
    const toProcess: Track[] = [];
    for (const track of tracks) {
      if (track.cover_original_url && track.cover_image_url.includes('thumbnail_')) {
        stats.alreadyMigrated++;
      } else {
        toProcess.push(track);
      }
    }

    if (toProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All tracks already migrated',
        stats,
      });
    }

    // Process tracks in batches
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);

      await Promise.all(
        batch.map(track => processSingleTrack(track, stats))
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      stats,
    });

  } catch (error) {
    console.error('[Migration API] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: String(error),
        stats,
      },
      { status: 500 }
    );
  }
}

async function processSingleTrack(
  track: Track,
  stats: MigrationStats
): Promise<void> {
  try {
    console.log(`[Migration] Processing track ${track.id.substring(0, 8)}...`);

    // Check if it's an R2 URL
    if (!track.cover_image_url.includes(R2_PUBLIC_DOMAIN.replace('https://', ''))) {
      console.log(`[Migration] Skipped ${track.id} - External URL`);
      stats.skipped++;
      return;
    }

    // Download the original image
    console.log(`[Migration] Downloading ${track.id}...`);
    const imageBuffer = await downloadFromUrl(track.cover_image_url);

    // Extract key information
    const key = extractKeyFromR2Url(track.cover_image_url);
    if (!key) {
      throw new Error('Could not extract key from URL');
    }

    const keyParts = key.split('/');
    const userId = keyParts[1] || 'anonymous';
    const taskId = keyParts[2] || track.music_id;
    const originalFilename = keyParts[keyParts.length - 1];

    // Generate and upload both versions
    console.log(`[Migration] Generating optimized versions for ${track.id}...`);
    const { thumbnailUrl, originalUrl } = await uploadCoverImageWithVersions(
      imageBuffer,
      taskId,
      originalFilename,
      userId
    );

    // Update database
    console.log(`[Migration] Updating database for ${track.id}...`);
    await query(
      `UPDATE tracks
       SET cover_image_url = $1,
           cover_original_url = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [thumbnailUrl, originalUrl, track.id]
    );

    console.log(`[Migration] Success for ${track.id}`);
    stats.successful++;

  } catch (error) {
    console.error(`[Migration] Failed for ${track.id}:`, error);
    stats.failed++;
    stats.errors.push(`Track ${track.id}: ${String(error)}`);
  }
}
