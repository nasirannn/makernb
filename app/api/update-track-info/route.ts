import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import { uploadCoverImage, downloadFromUrl, isManagedAssetUrl } from '@/lib/r2-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to update track info'
        },
        { status: 401 }
      );
    }

    const { trackId, title, coverImageUrl } = await request.json();

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // Validate title if provided
    if (title !== undefined) {
      if (!title || title.trim() === '') {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        );
      }
      if (title.length > 200) {
        return NextResponse.json(
          { error: 'Title must be 200 characters or less' },
          { status: 400 }
        );
      }
    }

    // Check if track exists and belongs to user
    const trackCheck = await query(
      `SELECT music_id, cover_image_url FROM tracks 
       WHERE id = $1 
       AND music_id IN (SELECT id FROM music WHERE user_id = $2::uuid)
       AND (is_deleted IS NULL OR is_deleted = FALSE)`,
      [trackId, userId]
    );

    if (trackCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Track not found or access denied' },
        { status: 404 }
      );
    }

    const existingTrack = trackCheck.rows[0];
    let finalCoverImageUrl = existingTrack.cover_image_url;

    // Handle cover image upload if provided
    if (coverImageUrl !== undefined) {
      // If coverImageUrl is empty string, it means remove the cover image
      if (coverImageUrl === '') {
        finalCoverImageUrl = null;
      } else {
        try {
          // If coverImageUrl is a data URL or blob URL, we need to handle it differently
          // For now, assume it's a URL that needs to be downloaded and uploaded to R2
          if (coverImageUrl.startsWith('data:') || coverImageUrl.startsWith('blob:')) {
          // Handle data URL or blob URL - convert to buffer
          let imageBuffer: Buffer;
          
          if (coverImageUrl.startsWith('data:')) {
            // Data URL: data:image/png;base64,...
            const base64Data = coverImageUrl.split(',')[1];
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else {
            // Blob URL - we'll need to fetch it
            const response = await fetch(coverImageUrl);
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
          }

          // Generate filename
          const timestamp = Date.now();
          const filename = `${timestamp}_${trackId}.png`;

          // Upload to R2
          finalCoverImageUrl = await uploadCoverImage(
            imageBuffer,
            trackId, // Use trackId as taskId
            filename,
            userId
          );
        } else if (coverImageUrl.startsWith('http') && !isManagedAssetUrl(coverImageUrl)) {
          // External URL - download and upload to R2
          const imageBuffer = await downloadFromUrl(coverImageUrl);
          const timestamp = Date.now();
          const filename = `${timestamp}_${trackId}.png`;
          
          finalCoverImageUrl = await uploadCoverImage(
            imageBuffer,
            trackId,
            filename,
            userId
          );
        } else {
            // Already an R2 URL or valid URL, use as is
            finalCoverImageUrl = coverImageUrl;
          }
        } catch (imageError) {
          console.error('Error processing cover image:', imageError);
          return NextResponse.json(
            { 
              error: 'Failed to process cover image',
              details: imageError instanceof Error ? imageError.message : 'Unknown error'
            },
            { status: 500 }
          );
        }
      }
    }

    // Build update query dynamically based on what's provided
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title.trim());
      paramIndex++;
    }

    if (coverImageUrl !== undefined) {
      updates.push(`cover_image_url = $${paramIndex}`);
      values.push(finalCoverImageUrl);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(trackId);

    // Update the track
    await query(
      `UPDATE tracks 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    return NextResponse.json({
      success: true,
      message: 'Track info updated successfully',
      data: {
        trackId,
        title: title !== undefined ? title.trim() : undefined,
        coverImageUrl: coverImageUrl !== undefined ? finalCoverImageUrl : undefined
      }
    });

  } catch (error) {
    console.error('Update track info error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while updating track info',
        success: false 
      },
      { status: 500 }
    );
  }
}
