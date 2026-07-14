-- 公版/原创歌词：非中文时补充中文备注字段
ALTER TABLE music_public_lyrics
  ADD COLUMN IF NOT EXISTS title_zh TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lyric_zh_remark TEXT NOT NULL DEFAULT '';

ALTER TABLE music_original_lyrics
  ADD COLUMN IF NOT EXISTS title_zh TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lyric_zh_remark TEXT NOT NULL DEFAULT '';
