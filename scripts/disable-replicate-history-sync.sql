BEGIN;

DROP TRIGGER IF EXISTS trg_sync_vocal_separation_history_replicate ON vocal_separations;
DROP FUNCTION IF EXISTS sync_vocal_separation_history_from_replicate();

DELETE FROM vocal_separation_history
WHERE source = 'replicate';

COMMIT;
