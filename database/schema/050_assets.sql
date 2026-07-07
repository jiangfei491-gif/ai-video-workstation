-- =============================================================================
-- Asset（统一资产）— 全系统唯一媒体元数据表，禁止模块自建 Asset 表
-- =============================================================================

CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  kind            asset_kind NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  storage_bucket  TEXT NOT NULL DEFAULT 'ai-cut',
  storage_key     TEXT NOT NULL,
  public_url      TEXT,
  filename        TEXT NOT NULL DEFAULT '',
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  sha256          CHAR(64),
  width           INT,
  height          INT,
  duration_sec    NUMERIC(10,3),
  source          TEXT NOT NULL DEFAULT '',
  provider_slug   CITEXT,
  model_slug      CITEXT,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE SET NULL,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE SET NULL,
  shot_index      INT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  legacy_filepath TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- 镜头 ↔ 资产关联（首帧/成片等，禁止重复 media 表）
CREATE TABLE IF NOT EXISTS shot_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE CASCADE,
  shot_index      INT NOT NULL,
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'frame',
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,
  model_slug      CITEXT,
  source          TEXT,
  qc_scores       JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 以下 VIEW 仅作语义分区，底层均为 assets 表（无独立物理表）
CREATE OR REPLACE VIEW image_assets AS
  SELECT * FROM assets WHERE kind = 'image';

CREATE OR REPLACE VIEW video_assets AS
  SELECT * FROM assets WHERE kind = 'video';

CREATE OR REPLACE VIEW audio_assets AS
  SELECT * FROM assets WHERE kind IN ('audio', 'bgm', 'sfx');

CREATE OR REPLACE VIEW thumbnail_assets AS
  SELECT * FROM assets WHERE kind IN ('thumbnail', 'cover');

CREATE OR REPLACE VIEW export_assets AS
  SELECT * FROM assets WHERE kind = 'export';

CREATE OR REPLACE VIEW subtitle_assets AS
  SELECT * FROM assets WHERE kind = 'subtitle';
