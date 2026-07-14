-- 用户粘贴导入的公版曲目（唯一入库来源）
CREATE TABLE IF NOT EXISTS music_imported_seeds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  seed_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  author          TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '其它',
  style_tags      TEXT[] NOT NULL DEFAULT '{}',
  language        TEXT NOT NULL DEFAULT 'en',
  death_year      INT,
  source_url      TEXT NOT NULL DEFAULT '',
  source_type     TEXT NOT NULL DEFAULT 'wikipedia',
  priority        INT NOT NULL DEFAULT 5,
  note            TEXT NOT NULL DEFAULT '',
  import_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, seed_id)
);

CREATE INDEX IF NOT EXISTS idx_music_imported_seeds_ws ON music_imported_seeds(workspace_id, created_at DESC);
