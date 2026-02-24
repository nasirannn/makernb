-- Harden DB constraints and indexes for callback/reconciliation consistency.
-- Safe to run multiple times.

BEGIN;

-- 1) Align generation_errors schema with TypeScript contract.
ALTER TABLE generation_errors
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE generation_errors
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE generation_errors
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

-- 2) user_subscriptions: enforce status domain and global subscription ID uniqueness.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'user_subscriptions'::regclass
      AND conname = 'user_subscriptions_status_check'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT user_subscriptions_status_check
      CHECK (status::text = ANY (ARRAY['active', 'cancelled', 'expired', 'past_due']::text[]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'user_subscriptions'::regclass
      AND conname = 'user_subscriptions_subscription_id_key'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT user_subscriptions_subscription_id_key UNIQUE (subscription_id);
  END IF;
END $$;

-- 3) cover_generations: one cover generation record per music task.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'cover_generations'::regclass
      AND conname = 'cover_generations_music_task_id_key'
  ) THEN
    ALTER TABLE cover_generations
      ADD CONSTRAINT cover_generations_music_task_id_key UNIQUE (music_task_id);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_cover_generations_music_task_id;

-- 4) vocal_removals: strict status states.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'vocal_removals'::regclass
      AND conname = 'vocal_removals_status_check'
  ) THEN
    ALTER TABLE vocal_removals
      ADD CONSTRAINT vocal_removals_status_check
      CHECK (status::text = ANY (ARRAY['processing', 'completed', 'error']::text[]));
  END IF;
END $$;

ALTER TABLE vocal_removals
  ALTER COLUMN status SET NOT NULL;

-- 5) vocal_separation_history: strict status states.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'vocal_separation_history'::regclass
      AND conname = 'vocal_separation_history_status_check'
  ) THEN
    ALTER TABLE vocal_separation_history
      ADD CONSTRAINT vocal_separation_history_status_check
      CHECK (status::text = ANY (ARRAY['processing', 'completed', 'error']::text[]));
  END IF;
END $$;

-- 6) vocal_separations: strict status states + unique provider prediction ID.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'vocal_separations'::regclass
      AND conname = 'vocal_separations_status_check'
  ) THEN
    ALTER TABLE vocal_separations
      ADD CONSTRAINT vocal_separations_status_check
      CHECK (status::text = ANY (ARRAY['processing', 'completed', 'error']::text[]));
  END IF;
END $$;

ALTER TABLE vocal_separations
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'vocal_separations'::regclass
      AND conname = 'vocal_separations_prediction_id_key'
  ) THEN
    ALTER TABLE vocal_separations
      ADD CONSTRAINT vocal_separations_prediction_id_key UNIQUE (prediction_id);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_vocal_separations_prediction_id;

-- 7) lyrics: remove redundant index (covered by lyrics_music_id_key unique index).
DROP INDEX IF EXISTS idx_lyrics_music_id;

COMMIT;
