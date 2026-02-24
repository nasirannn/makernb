import { query } from '@/lib/db-query-builder';

export type CallbackEventProcessStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface CreateCallbackEventInput {
  provider: string;
  sourceLabel: string;
  taskId: string;
  callbackType?: string | null;
  code: number;
  payload: unknown;
  payloadHash: string;
}

export interface CreateCallbackEventResult {
  enabled: boolean;
  accepted: boolean;
  eventId?: string;
  duplicateStatus?: CallbackEventProcessStatus;
}

function isUndefinedTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const pgCode = (error as { code?: string }).code;
  if (pgCode === '42P01') return true;
  const message = (error as { message?: string }).message || '';
  return message.includes('relation') && message.includes('callback_events');
}

function truncateErrorMessage(input: unknown, fallback = 'Unknown callback event error'): string {
  const value = typeof input === 'string' ? input : (input instanceof Error ? input.message : '');
  const normalized = (value || fallback).trim();
  return normalized.length > 1200 ? normalized.slice(0, 1200) : normalized;
}

export async function createCallbackEvent(input: CreateCallbackEventInput): Promise<CreateCallbackEventResult> {
  try {
    const duplicateResult = await query<{
      id: string;
      process_status: CallbackEventProcessStatus;
    }>(
      `SELECT id, process_status
       FROM callback_events
       WHERE provider = $1
         AND source_label = $2
         AND task_id = $3
         AND COALESCE(callback_type, '') = COALESCE($4, '')
         AND code = $5
         AND payload_hash = $6
         AND process_status IN ('pending', 'processing', 'processed')
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        input.provider,
        input.sourceLabel,
        input.taskId,
        input.callbackType || null,
        input.code,
        input.payloadHash,
      ]
    );

    if (duplicateResult.rows.length > 0) {
      return {
        enabled: true,
        accepted: false,
        eventId: duplicateResult.rows[0].id,
        duplicateStatus: duplicateResult.rows[0].process_status,
      };
    }

    const insertResult = await query<{ id: string }>(
      `INSERT INTO callback_events (
        provider,
        source_label,
        task_id,
        callback_type,
        code,
        payload,
        payload_hash,
        process_status,
        process_attempts,
        next_retry_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'pending', 0, NOW())
      RETURNING id`,
      [
        input.provider,
        input.sourceLabel,
        input.taskId,
        input.callbackType || null,
        input.code,
        JSON.stringify(input.payload ?? {}),
        input.payloadHash,
      ]
    );

    return {
      enabled: true,
      accepted: true,
      eventId: insertResult.rows[0]?.id,
    };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        enabled: false,
        accepted: true,
      };
    }
    throw error;
  }
}

export async function markCallbackEventProcessing(eventId: string): Promise<void> {
  await query(
    `UPDATE callback_events
     SET process_status = 'processing',
         process_attempts = process_attempts + 1,
         last_error = NULL
     WHERE id = $1`,
    [eventId]
  );
}

export async function markCallbackEventProcessed(eventId: string): Promise<void> {
  await query(
    `UPDATE callback_events
     SET process_status = 'processed',
         processed_at = NOW(),
         last_error = NULL
     WHERE id = $1`,
    [eventId]
  );
}

export async function markCallbackEventFailed(
  eventId: string,
  reason: unknown,
  retryAfterSeconds = 300
): Promise<void> {
  const safeRetryAfterSeconds = Number.isFinite(retryAfterSeconds)
    ? Math.max(60, Math.min(24 * 60 * 60, Math.floor(retryAfterSeconds)))
    : 300;
  const lastError = truncateErrorMessage(reason);

  await query(
    `UPDATE callback_events
     SET process_status = 'failed',
         last_error = $2,
         next_retry_at = NOW() + ($3 * INTERVAL '1 second')
     WHERE id = $1`,
    [eventId, lastError, safeRetryAfterSeconds]
  );
}
