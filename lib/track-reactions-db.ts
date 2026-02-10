import { query } from '@/lib/db-query-builder';

let ensureTrackReactionsSchemaPromise: Promise<void> | null = null;

export const ensureTrackReactionsSchema = async () => {
  if (!ensureTrackReactionsSchemaPromise) {
    ensureTrackReactionsSchemaPromise = (async () => {
      await query(`
        ALTER TABLE tracks
        ADD COLUMN IF NOT EXISTS is_liked BOOLEAN NOT NULL DEFAULT FALSE
      `);

      await query(`
        ALTER TABLE tracks
        ADD COLUMN IF NOT EXISTS is_disliked BOOLEAN NOT NULL DEFAULT FALSE
      `);

      await query(`
        UPDATE tracks
        SET is_disliked = FALSE
        WHERE COALESCE(is_liked, FALSE) = TRUE
          AND COALESCE(is_disliked, FALSE) = TRUE
      `);

      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'tracks_like_dislike_mutual_exclusion_chk'
              AND conrelid = 'tracks'::regclass
          ) THEN
            ALTER TABLE tracks
            ADD CONSTRAINT tracks_like_dislike_mutual_exclusion_chk
            CHECK (NOT (is_liked AND is_disliked));
          END IF;
        END
        $$;
      `);
    })();
  }

  await ensureTrackReactionsSchemaPromise;
};
