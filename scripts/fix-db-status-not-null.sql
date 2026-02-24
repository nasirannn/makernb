-- Harden status columns to NOT NULL where values are already fully populated.
-- Safe to run multiple times (no-op when already NOT NULL).

BEGIN;

ALTER TABLE cover_generations
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE lyrics_generations
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE music
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE track_midi_generations
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE track_mp4_generations
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE track_wav_conversions
  ALTER COLUMN status SET NOT NULL;

COMMIT;
