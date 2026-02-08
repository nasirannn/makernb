import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

const PERSONA_NAME_MAX_LENGTH = 100;
const PERSONA_DESCRIPTION_MAX_LENGTH = 1000;

const mapPersonaRow = (row: any) => ({
  id: row.id,
  trackId: row.track_id,
  taskId: row.task_id,
  audioId: row.audio_id,
  personaId: row.persona_id,
  status: row.status === 'deleted' ? 'deleted' : 'active',
  name: row.name,
  description: row.description,
  trackTitle: row.track_title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function GET(request: NextRequest) {
  try {
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const { userId } = userInfo;

    const result = await query(
      `SELECT
        tp.id,
        tp.track_id,
        tp.task_id,
        tp.audio_id,
        tp.persona_id,
        tp.status,
        tp.name,
        tp.description,
        tp.created_at,
        tp.updated_at,
        COALESCE(t.title, 'Untitled Track') AS track_title
       FROM track_personas tp
       JOIN tracks t ON t.id = tp.track_id
       JOIN music m ON m.id = t.music_id
       WHERE m.user_id = $1::uuid
         AND COALESCE(tp.status, 'active') = 'active'
       ORDER BY tp.created_at DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      data: result.rows.map(mapPersonaRow),
    });
  } catch (error) {
    console.error('[PERSONA-LIST] Failed to load personas:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load personas',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const { userId } = userInfo;
    const payload = await request.json();

    const personaRecordId = payload?.id || payload?.personaRecordId;
    const rawName = payload?.name;
    const rawDescription = payload?.description;

    if (!personaRecordId || typeof personaRecordId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'personaRecordId is required',
        },
        { status: 400 }
      );
    }

    const hasNameField = Object.prototype.hasOwnProperty.call(payload ?? {}, 'name');
    const hasDescriptionField = Object.prototype.hasOwnProperty.call(payload ?? {}, 'description');

    if (!hasNameField && !hasDescriptionField) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one editable field is required',
        },
        { status: 400 }
      );
    }

    const updateFields: string[] = [];
    const values: any[] = [personaRecordId, userId];
    let paramIndex = 3;

    if (hasNameField) {
      if (rawName !== null && typeof rawName !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'name must be a string',
          },
          { status: 400 }
        );
      }

      const normalizedName = rawName === null ? null : rawName.trim().slice(0, PERSONA_NAME_MAX_LENGTH) || null;
      updateFields.push(`name = $${paramIndex++}`);
      values.push(normalizedName);
    }

    if (hasDescriptionField) {
      if (rawDescription !== null && typeof rawDescription !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'description must be a string',
          },
          { status: 400 }
        );
      }

      const normalizedDescription = rawDescription === null
        ? null
        : rawDescription.trim().slice(0, PERSONA_DESCRIPTION_MAX_LENGTH) || null;

      updateFields.push(`description = $${paramIndex++}`);
      values.push(normalizedDescription);
    }

    updateFields.push('updated_at = NOW()');

    const result = await query(
      `UPDATE track_personas tp
       SET ${updateFields.join(', ')}
       FROM tracks t
       JOIN music m ON m.id = t.music_id
       WHERE tp.id = $1::uuid
         AND tp.track_id = t.id
         AND m.user_id = $2::uuid
         AND COALESCE(tp.status, 'active') = 'active'
       RETURNING tp.*, COALESCE(t.title, 'Untitled Track') AS track_title`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Persona not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapPersonaRow(result.rows[0]),
    });
  } catch (error) {
    console.error('[PERSONA-UPDATE] Failed to update persona:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update persona',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const { userId } = userInfo;
    const payload = await request.json();
    const personaRecordId = payload?.id || payload?.personaRecordId;

    if (!personaRecordId || typeof personaRecordId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'personaRecordId is required',
        },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE track_personas tp
       SET status = 'deleted', updated_at = NOW()
       FROM tracks t
       JOIN music m ON m.id = t.music_id
       WHERE tp.id = $1::uuid
         AND tp.track_id = t.id
         AND m.user_id = $2::uuid
         AND COALESCE(tp.status, 'active') = 'active'
       RETURNING tp.id, tp.persona_id`,
      [personaRecordId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Persona not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        personaId: result.rows[0].persona_id,
      },
    });
  } catch (error) {
    console.error('[PERSONA-DELETE] Failed to delete persona:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete persona',
      },
      { status: 500 }
    );
  }
}
