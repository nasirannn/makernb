-- Harden callback pipeline with persistent callback events and dedupe indexes.
-- Run with:
--   set -a; source .env.local; set +a;
--   DATABASE_URL="${DATABASE_URL/sslmode=verify-full/sslmode=require}";
--   psql "$DATABASE_URL" -f scripts/harden-music-callback-pipeline.sql

-- 1) Callback inbox/event table
CREATE TABLE IF NOT EXISTS callback_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider character varying(32) NOT NULL,
  source_label character varying(32) NOT NULL,
  task_id character varying(255) NOT NULL,
  callback_type character varying(32),
  code integer NOT NULL,
  payload jsonb NOT NULL,
  payload_hash character(64) NOT NULL,
  process_status character varying(20) NOT NULL DEFAULT 'pending',
  process_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamp with time zone NOT NULL DEFAULT NOW(),
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CHECK (process_status IN ('pending', 'processing', 'processed', 'failed'))
);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_callback_events_dedupe
ON callback_events (provider, source_label, task_id, callback_type, code, payload_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_callback_events_pending
ON callback_events (process_status, next_retry_at, created_at);

-- 2) Track dedupe for same music + same suno_track_id
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_tracks_music_suno_active
ON tracks (music_id, suno_track_id)
WHERE suno_track_id IS NOT NULL
  AND COALESCE(is_deleted, FALSE) = FALSE;

-- 3) Reconcile scan index for non-final music tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_reconcile_scan
ON music (status, updated_at)
WHERE task_id IS NOT NULL
  AND status IN ('generating', 'text', 'first');

-- 4) Generation error query index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_errors_type_ref_created
ON generation_errors (error_type, reference_id, created_at DESC);

-- 5) Repair invalid idempotency index on credit transactions
DROP INDEX CONCURRENTLY IF EXISTS credit_transactions_reference_type_unique;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS credit_transactions_reference_type_unique
ON credit_transactions (reference_id, transaction_type)
WHERE reference_id IS NOT NULL;
