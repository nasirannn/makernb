import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db-query-builder';
import { reconcileMusicTaskFromRecordInfo } from '@/lib/callbacks/suno-callback-handler';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_STALE_MINUTES = 5;
const MAX_STALE_MINUTES = 240;
const DEFAULT_STATUSES = ['generating', 'text', 'first'];

function parseBoundedInt(rawValue: string | null, fallback: number, min: number, max: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseStatuses(rawStatuses: string | null): string[] {
  if (!rawStatuses) return DEFAULT_STATUSES;
  const statuses = rawStatuses
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const allowed = new Set(['generating', 'text', 'first', 'complete', 'error']);
  const filtered = statuses.filter((status) => allowed.has(status));
  return filtered.length > 0 ? filtered : DEFAULT_STATUSES;
}

function validateCronAuth(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const unauthorizedResponse = validateCronAuth(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  const startedAt = Date.now();
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const staleMinutes = parseBoundedInt(
    url.searchParams.get('staleMinutes'),
    DEFAULT_STALE_MINUTES,
    1,
    MAX_STALE_MINUTES
  );
  const statuses = parseStatuses(url.searchParams.get('statuses'));

  try {
    const stuckResult = await query(
      `SELECT id, task_id, status, updated_at
       FROM music
       WHERE task_id IS NOT NULL
         AND status = ANY($1::text[])
         AND updated_at <= NOW() - ($2 * INTERVAL '1 minute')
       ORDER BY updated_at ASC
       LIMIT $3`,
      [statuses, staleMinutes, limit]
    );

    const tasks = stuckResult.rows as Array<{
      id: string;
      task_id: string;
      status: string;
      updated_at: string;
    }>;

    const details: Array<{
      musicId: string;
      taskId: string;
      previousStatus: string;
      updatedAt: string;
      success: boolean;
      reason: string;
      trackCount: number;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    for (const task of tasks) {
      const reconcileResult = await reconcileMusicTaskFromRecordInfo(task.task_id, 'cron-reconcile');
      if (reconcileResult.success) {
        successCount++;
      } else {
        failureCount++;
      }

      details.push({
        musicId: task.id,
        taskId: task.task_id,
        previousStatus: task.status,
        updatedAt: task.updated_at,
        success: reconcileResult.success,
        reason: reconcileResult.reason,
        trackCount: reconcileResult.trackCount,
      });
    }

    return NextResponse.json({
      success: true,
      scanned: tasks.length,
      successCount,
      failureCount,
      limit,
      staleMinutes,
      statuses,
      durationMs: Date.now() - startedAt,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON-RECONCILE] Failed to reconcile music callbacks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reconcile music callbacks',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
