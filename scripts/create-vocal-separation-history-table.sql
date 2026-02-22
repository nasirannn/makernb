BEGIN;

CREATE TABLE IF NOT EXISTS vocal_separation_history (
  source TEXT NOT NULL CHECK (source IN ('replicate', 'kie')),
  source_record_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  separation_type TEXT,
  prediction_id TEXT,
  task_id TEXT,
  track_id UUID,
  music_id UUID,
  original_filename TEXT,
  original_audio_url TEXT,
  vocal_url TEXT,
  instrumental_url TEXT,
  stems_data JSONB,
  error_code TEXT,
  error_message TEXT,
  has_persistent_audio BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_vocal_separation_history_user_created
  ON vocal_separation_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vocal_separation_history_source_user_created
  ON vocal_separation_history (source, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vocal_separation_history_not_deleted
  ON vocal_separation_history (is_deleted);

CREATE OR REPLACE FUNCTION sync_vocal_separation_history_from_replicate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO vocal_separation_history (
    source,
    source_record_id,
    user_id,
    status,
    separation_type,
    prediction_id,
    task_id,
    track_id,
    music_id,
    original_filename,
    original_audio_url,
    vocal_url,
    instrumental_url,
    stems_data,
    error_code,
    error_message,
    has_persistent_audio,
    is_deleted,
    created_at,
    updated_at
  ) VALUES (
    'replicate',
    NEW.id,
    NEW.user_id,
    COALESCE(NEW.status, 'processing'),
    'separate_vocal',
    NEW.prediction_id,
    NULL,
    NULL,
    NULL,
    NEW.original_filename,
    NEW.original_audio_url,
    NEW.vocal_audio_url,
    NEW.instrumental_audio_url,
    NULL,
    NEW.error_code,
    NEW.error_message,
    FALSE,
    COALESCE(NEW.is_deleted, FALSE),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NEW.created_at, NOW())
  )
  ON CONFLICT (source, source_record_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    separation_type = EXCLUDED.separation_type,
    prediction_id = EXCLUDED.prediction_id,
    original_filename = EXCLUDED.original_filename,
    original_audio_url = EXCLUDED.original_audio_url,
    vocal_url = EXCLUDED.vocal_url,
    instrumental_url = EXCLUDED.instrumental_url,
    error_code = EXCLUDED.error_code,
    error_message = EXCLUDED.error_message,
    is_deleted = EXCLUDED.is_deleted,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vocal_separation_history_replicate ON vocal_separations;

CREATE TRIGGER trg_sync_vocal_separation_history_replicate
AFTER INSERT OR UPDATE ON vocal_separations
FOR EACH ROW
EXECUTE FUNCTION sync_vocal_separation_history_from_replicate();

CREATE OR REPLACE FUNCTION sync_vocal_separation_history_from_kie()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO vocal_separation_history (
    source,
    source_record_id,
    user_id,
    status,
    separation_type,
    prediction_id,
    task_id,
    track_id,
    music_id,
    original_filename,
    original_audio_url,
    vocal_url,
    instrumental_url,
    stems_data,
    error_code,
    error_message,
    has_persistent_audio,
    is_deleted,
    created_at,
    updated_at
  ) VALUES (
    'kie',
    NEW.id,
    NEW.user_id,
    COALESCE(NEW.status, 'processing'),
    COALESCE(NEW.separation_type, 'separate_vocal'),
    NULL,
    NEW.task_id,
    NEW.track_id,
    NEW.music_id,
    NULL,
    NULL,
    COALESCE(NEW.r2_vocal_url, NEW.vocal_url),
    COALESCE(NEW.r2_instrumental_url, NEW.instrumental_url),
    NEW.stems_data,
    NEW.error_code,
    NEW.error_message,
    (COALESCE(NEW.r2_vocal_url, '') <> '' OR COALESCE(NEW.r2_instrumental_url, '') <> ''),
    COALESCE(NEW.is_deleted, FALSE),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NEW.created_at, NOW())
  )
  ON CONFLICT (source, source_record_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    separation_type = EXCLUDED.separation_type,
    task_id = EXCLUDED.task_id,
    track_id = EXCLUDED.track_id,
    music_id = EXCLUDED.music_id,
    vocal_url = EXCLUDED.vocal_url,
    instrumental_url = EXCLUDED.instrumental_url,
    stems_data = EXCLUDED.stems_data,
    error_code = EXCLUDED.error_code,
    error_message = EXCLUDED.error_message,
    has_persistent_audio = EXCLUDED.has_persistent_audio,
    is_deleted = EXCLUDED.is_deleted,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vocal_separation_history_kie ON vocal_removals;

CREATE TRIGGER trg_sync_vocal_separation_history_kie
AFTER INSERT OR UPDATE ON vocal_removals
FOR EACH ROW
EXECUTE FUNCTION sync_vocal_separation_history_from_kie();

INSERT INTO vocal_separation_history (
  source,
  source_record_id,
  user_id,
  status,
  separation_type,
  prediction_id,
  task_id,
  track_id,
  music_id,
  original_filename,
  original_audio_url,
  vocal_url,
  instrumental_url,
  stems_data,
  error_code,
  error_message,
  has_persistent_audio,
  is_deleted,
  created_at,
  updated_at
)
SELECT
  'replicate' AS source,
  vs.id AS source_record_id,
  vs.user_id,
  COALESCE(vs.status, 'processing') AS status,
  'separate_vocal' AS separation_type,
  vs.prediction_id,
  NULL::TEXT AS task_id,
  NULL::UUID AS track_id,
  NULL::UUID AS music_id,
  vs.original_filename,
  vs.original_audio_url,
  vs.vocal_audio_url AS vocal_url,
  vs.instrumental_audio_url AS instrumental_url,
  NULL::JSONB AS stems_data,
  vs.error_code,
  vs.error_message,
  FALSE AS has_persistent_audio,
  COALESCE(vs.is_deleted, FALSE) AS is_deleted,
  COALESCE(vs.created_at, NOW()) AS created_at,
  COALESCE(vs.updated_at, vs.created_at, NOW()) AS updated_at
FROM vocal_separations vs
ON CONFLICT (source, source_record_id)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  status = EXCLUDED.status,
  prediction_id = EXCLUDED.prediction_id,
  original_filename = EXCLUDED.original_filename,
  original_audio_url = EXCLUDED.original_audio_url,
  vocal_url = EXCLUDED.vocal_url,
  instrumental_url = EXCLUDED.instrumental_url,
  error_code = EXCLUDED.error_code,
  error_message = EXCLUDED.error_message,
  is_deleted = EXCLUDED.is_deleted,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO vocal_separation_history (
  source,
  source_record_id,
  user_id,
  status,
  separation_type,
  prediction_id,
  task_id,
  track_id,
  music_id,
  original_filename,
  original_audio_url,
  vocal_url,
  instrumental_url,
  stems_data,
  error_code,
  error_message,
  has_persistent_audio,
  is_deleted,
  created_at,
  updated_at
)
SELECT
  'kie' AS source,
  vr.id AS source_record_id,
  vr.user_id,
  COALESCE(vr.status, 'processing') AS status,
  COALESCE(vr.separation_type, 'separate_vocal') AS separation_type,
  NULL::TEXT AS prediction_id,
  vr.task_id,
  vr.track_id,
  vr.music_id,
  NULL::TEXT AS original_filename,
  NULL::TEXT AS original_audio_url,
  COALESCE(vr.r2_vocal_url, vr.vocal_url) AS vocal_url,
  COALESCE(vr.r2_instrumental_url, vr.instrumental_url) AS instrumental_url,
  vr.stems_data,
  vr.error_code,
  vr.error_message,
  (COALESCE(vr.r2_vocal_url, '') <> '' OR COALESCE(vr.r2_instrumental_url, '') <> '') AS has_persistent_audio,
  COALESCE(vr.is_deleted, FALSE) AS is_deleted,
  COALESCE(vr.created_at, NOW()) AS created_at,
  COALESCE(vr.updated_at, vr.created_at, NOW()) AS updated_at
FROM vocal_removals vr
ON CONFLICT (source, source_record_id)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  status = EXCLUDED.status,
  separation_type = EXCLUDED.separation_type,
  task_id = EXCLUDED.task_id,
  track_id = EXCLUDED.track_id,
  music_id = EXCLUDED.music_id,
  vocal_url = EXCLUDED.vocal_url,
  instrumental_url = EXCLUDED.instrumental_url,
  stems_data = EXCLUDED.stems_data,
  error_code = EXCLUDED.error_code,
  error_message = EXCLUDED.error_message,
  has_persistent_audio = EXCLUDED.has_persistent_audio,
  is_deleted = EXCLUDED.is_deleted,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

COMMIT;
