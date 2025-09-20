-- Add soft delete field to music_generations table
ALTER TABLE music_generations ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Add index for better query performance
CREATE INDEX idx_music_generations_is_deleted ON music_generations(is_deleted);

-- Add index for user_id + is_deleted for common queries
CREATE INDEX idx_music_generations_user_deleted ON music_generations(user_id, is_deleted);
