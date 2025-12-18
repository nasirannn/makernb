/**
 * Historical Image Migration Script
 *
 * Purpose: Migrate existing cover images to dual-version format
 * - Copy current cover_image_url to cover_original_url (preserve original)
 * - Download original images from R2
 * - Generate optimized thumbnails
 * - Upload thumbnails to R2
 * - Update cover_image_url to use thumbnail URLs
 *
 * Usage:
 * 1. Dry run (preview): npm run migrate:images
 * 2. Execute: npm run migrate:images -- --execute
 * 3. Limit: npm run migrate:images -- --execute --limit 10
 */

import { query } from '../lib/db-pool';
import { downloadFromUrl, uploadCoverImageWithVersions, extractKeyFromR2Url } from '../lib/r2-storage';
import { compressImageForThumbnail, getOptimizedFilename } from '../lib/image-optimization';

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
}

async function migrateHistoricalImages(options: {
  execute: boolean;
  limit?: number;
  batchSize?: number;
}) {
  const { execute = false, limit, batchSize = 5 } = options;

  console.log('='.repeat(80));
  console.log('🖼️  HISTORICAL IMAGE MIGRATION SCRIPT');
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '🚀 EXECUTE' : '👀 DRY RUN (Preview Only)'}`);
  console.log(`Limit: ${limit || 'All tracks'}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log('='.repeat(80));
  console.log();

  const stats: MigrationStats = {
    total: 0,
    alreadyMigrated: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Step 1: Find tracks that need migration
    console.log('📊 Step 1: Analyzing tracks...\n');

    const findTracksQuery = `
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
    `;

    const result = await query<Track>(findTracksQuery);
    const tracks = result.rows;

    stats.total = tracks.length;

    console.log(`Found ${stats.total} tracks with cover images\n`);

    if (stats.total === 0) {
      console.log('✅ No tracks to migrate!');
      return;
    }

    // Step 2: Categorize tracks
    const needsMigration: Track[] = [];
    const alreadyMigrated: Track[] = [];
    const needsThumbnailOnly: Track[] = [];

    for (const track of tracks) {
      // Check if already has both versions
      if (track.cover_original_url &&
          track.cover_image_url.includes('thumbnail_')) {
        alreadyMigrated.push(track);
        stats.alreadyMigrated++;
      }
      // Has original but needs thumbnail
      else if (track.cover_original_url &&
               !track.cover_image_url.includes('thumbnail_')) {
        needsThumbnailOnly.push(track);
      }
      // Needs full migration
      else {
        needsMigration.push(track);
      }
    }

    console.log('📋 Migration Status:');
    console.log(`  ✅ Already migrated: ${alreadyMigrated.length}`);
    console.log(`  🔄 Needs thumbnail only: ${needsThumbnailOnly.length}`);
    console.log(`  🆕 Needs full migration: ${needsMigration.length}`);
    console.log();

    // Step 3: Process tracks in batches
    const toProcess = [...needsThumbnailOnly, ...needsMigration];

    if (toProcess.length === 0) {
      console.log('✅ All tracks are already migrated!');
      printStats(stats);
      return;
    }

    console.log(`🔧 Step 2: ${execute ? 'Processing' : 'Previewing'} ${toProcess.length} tracks...\n`);

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      console.log(`📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toProcess.length / batchSize)}`);

      await Promise.all(
        batch.map(track => processSingleTrack(track, execute, stats))
      );

      console.log();
    }

    // Step 4: Summary
    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(80));
    printStats(stats);

    if (!execute) {
      console.log();
      console.log('💡 This was a DRY RUN. To execute the migration, run:');
      console.log('   npx tsx scripts/migrate-historical-images.ts --execute');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function processSingleTrack(
  track: Track,
  execute: boolean,
  stats: MigrationStats
): Promise<void> {
  const trackPrefix = `[Track ${track.id.substring(0, 8)}]`;

  try {
    console.log(`${trackPrefix} Processing...`);

    // Check if it's an R2 URL (our CDN domain)
    if (!track.cover_image_url.includes(R2_PUBLIC_DOMAIN.replace('https://', ''))) {
      console.log(`${trackPrefix} ⚠️  Skipped - External URL (not in R2)`);
      stats.skipped++;
      return;
    }

    if (!execute) {
      console.log(`${trackPrefix} 👀 Would migrate: ${track.cover_image_url}`);
      if (!track.cover_original_url) {
        console.log(`${trackPrefix}    → Set original_url: ${track.cover_image_url}`);
      }
      console.log(`${trackPrefix}    → Generate thumbnail and update image_url`);
      stats.successful++;
      return;
    }

    // EXECUTE MODE
    console.log(`${trackPrefix} 📥 Downloading original...`);

    // Download the original image
    const imageBuffer = await downloadFromUrl(track.cover_image_url);

    console.log(`${trackPrefix} 🔧 Generating thumbnail...`);

    // Extract task ID and user ID from the URL
    const key = extractKeyFromR2Url(track.cover_image_url);
    if (!key) {
      throw new Error('Could not extract key from URL');
    }

    // Parse key: covers/userId/taskId/filename
    const keyParts = key.split('/');
    const userId = keyParts[1] || 'anonymous';
    const taskId = keyParts[2] || track.music_id;
    const originalFilename = keyParts[keyParts.length - 1];

    // Generate thumbnail using our optimization library
    const thumbnailData = await compressImageForThumbnail(imageBuffer);
    const thumbnailFilename = getOptimizedFilename(originalFilename, 'webp', 'thumbnail');

    // Upload thumbnail to R2
    console.log(`${trackPrefix} 📤 Uploading thumbnail...`);

    const { thumbnailUrl, originalUrl } = await uploadCoverImageWithVersions(
      imageBuffer,
      taskId,
      originalFilename,
      userId
    );

    console.log(`${trackPrefix} 💾 Updating database...`);

    // Update database
    await query(
      `UPDATE tracks
       SET cover_image_url = $1,
           cover_original_url = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [thumbnailUrl, originalUrl, track.id]
    );

    console.log(`${trackPrefix} ✅ Success!`);
    console.log(`${trackPrefix}    Thumbnail: ${(thumbnailData.size / 1024).toFixed(1)}KB`);
    console.log(`${trackPrefix}    Savings: ${(((imageBuffer.length - thumbnailData.size) / imageBuffer.length) * 100).toFixed(1)}%`);

    stats.successful++;

  } catch (error) {
    console.error(`${trackPrefix} ❌ Failed:`, error);
    stats.failed++;
  }
}

function printStats(stats: MigrationStats) {
  console.log();
  console.log('📊 Migration Statistics:');
  console.log(`  Total tracks: ${stats.total}`);
  console.log(`  Already migrated: ${stats.alreadyMigrated}`);
  console.log(`  Successfully migrated: ${stats.successful}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Skipped (external URLs): ${stats.skipped}`);

  if (stats.successful > 0) {
    console.log();
    console.log(`💡 Estimated bandwidth savings: ${(stats.successful * 0.42).toFixed(1)}MB per page load`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;
const batchSizeIndex = args.indexOf('--batch-size');
const batchSize = batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1], 10) : 5;

// Run migration
migrateHistoricalImages({
  execute,
  limit,
  batchSize,
}).then(() => {
  console.log();
  console.log('✅ Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error();
  console.error('❌ Script failed:', error);
  process.exit(1);
});
