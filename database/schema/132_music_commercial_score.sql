-- 公版歌词：商业价值评分 + 翻唱热度 + 商业标签
ALTER TABLE music_public_lyrics
  ADD COLUMN IF NOT EXISTS overall_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_hotness TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS commercial_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score_details JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_score
  ON music_public_lyrics(workspace_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_commercial
  ON music_public_lyrics USING GIN(commercial_tags);
