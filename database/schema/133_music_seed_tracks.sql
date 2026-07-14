-- 公版歌词导入曲目同步状态（曲目来自用户粘贴导入）
CREATE TABLE IF NOT EXISTS music_seed_status (
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  seed_id         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT,
  lyric_id        UUID REFERENCES music_public_lyrics(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, seed_id)
);

CREATE INDEX IF NOT EXISTS idx_music_seed_status_ws ON music_seed_status(workspace_id, status);
