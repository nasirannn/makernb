-- Ensure updated_at is automatically refreshed on every UPDATE.
-- Safe to run multiple times.

BEGIN;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'cover_generations',
    'features',
    'generation_errors',
    'lyrics_generations',
    'music',
    'subscription_tiers',
    'tier_features',
    'track_midi_generations',
    'track_mp4_generations',
    'track_personas',
    'track_timestamped_lyrics',
    'track_wav_conversions',
    'tracks',
    'user_credits',
    'user_favorites',
    'user_subscriptions',
    'vocal_removals',
    'vocal_separation_history',
    'vocal_separations'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I', target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
      target_table
    );
  END LOOP;
END $$;

COMMIT;
