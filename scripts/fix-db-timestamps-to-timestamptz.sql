-- Normalize mixed timestamp types to timestamptz (UTC semantics).
-- Safe to run multiple times.

BEGIN;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM (
      VALUES
        ('features', 'created_at'),
        ('features', 'updated_at'),
        ('subscription_tiers', 'created_at'),
        ('subscription_tiers', 'updated_at'),
        ('tier_features', 'created_at'),
        ('tier_features', 'updated_at'),
        ('track_midi_generations', 'created_at'),
        ('track_midi_generations', 'updated_at'),
        ('track_mp4_generations', 'created_at'),
        ('track_mp4_generations', 'updated_at'),
        ('track_personas', 'created_at'),
        ('track_personas', 'updated_at'),
        ('track_wav_conversions', 'created_at'),
        ('track_wav_conversions', 'updated_at')
    ) AS t(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = rec.table_name
        AND c.column_name = rec.column_name
        AND c.data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
        rec.table_name,
        rec.column_name,
        rec.column_name
      );

      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT NOW()',
        rec.table_name,
        rec.column_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
