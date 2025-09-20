-- 为 music_tracks 表添加 is_pinned 字段
ALTER TABLE music_tracks
ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;

-- 添加索引以提高查询性能
CREATE INDEX idx_music_tracks_is_pinned ON music_tracks (is_pinned);

-- 添加注释
COMMENT ON COLUMN music_tracks.is_pinned IS 'Whether this track is pinned by admin for explore page';
