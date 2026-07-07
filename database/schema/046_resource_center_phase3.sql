-- =============================================================================
-- Resource Center Phase 3 — AI Analyzer / Library Items / Import / Access Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS resource_analysis_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  download_task_id  UUID REFERENCES resource_download_tasks(id) ON DELETE SET NULL,
  source_id         UUID REFERENCES resource_sources(id) ON DELETE SET NULL,
  local_path        TEXT NOT NULL DEFAULT '',
  filename          TEXT NOT NULL DEFAULT '',
  mime_type         TEXT NOT NULL DEFAULT '',
  file_size         BIGINT NOT NULL DEFAULT 0,
  sha256            CHAR(64),
  status            TEXT NOT NULL DEFAULT 'pending_analysis',
  library_id        TEXT,
  analysis_result   JSONB NOT NULL DEFAULT '{}',
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_analysis_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES resource_analysis_tasks(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_import_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  analysis_task_id  UUID NOT NULL REFERENCES resource_analysis_tasks(id) ON DELETE CASCADE,
  library_item_id   UUID,
  library_id        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending_import',
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_import_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES resource_import_tasks(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_library_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  library_id        TEXT NOT NULL,
  download_task_id  UUID REFERENCES resource_download_tasks(id) ON DELETE SET NULL,
  analysis_task_id  UUID REFERENCES resource_analysis_tasks(id) ON DELETE SET NULL,
  import_task_id    UUID REFERENCES resource_import_tasks(id) ON DELETE SET NULL,
  source_id         UUID REFERENCES resource_sources(id) ON DELETE SET NULL,
  title             TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  language          TEXT NOT NULL DEFAULT '',
  style             TEXT NOT NULL DEFAULT '',
  mood              TEXT NOT NULL DEFAULT '',
  purpose           TEXT NOT NULL DEFAULT '',
  platform          TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'imported',
  rating            NUMERIC(4,2),
  quality_score     NUMERIC(4,2),
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  favorite          BOOLEAN NOT NULL DEFAULT FALSE,
  local_path        TEXT NOT NULL DEFAULT '',
  thumbnail_path    TEXT NOT NULL DEFAULT '',
  preview_path      TEXT NOT NULL DEFAULT '',
  tags              TEXT[] NOT NULL DEFAULT '{}',
  keywords          TEXT[] NOT NULL DEFAULT '{}',
  sha256            CHAR(64),
  file_size         BIGINT NOT NULL DEFAULT 0,
  mime_type         TEXT NOT NULL DEFAULT '',
  metadata          JSONB NOT NULL DEFAULT '{}',
  db_primary_table  TEXT NOT NULL DEFAULT '',
  db_record_id      UUID,
  search_text       TSVECTOR,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS resource_library_relations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id_a       UUID NOT NULL REFERENCES resource_library_items(id) ON DELETE CASCADE,
  item_id_b       UUID NOT NULL REFERENCES resource_library_items(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL DEFAULT 'similar',
  score           NUMERIC(4,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id_a, item_id_b, relation_type)
);

CREATE TABLE IF NOT EXISTS resource_access_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_id     TEXT NOT NULL DEFAULT '',
  module_label  TEXT NOT NULL DEFAULT '',
  query         JSONB NOT NULL DEFAULT '{}',
  result_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_analysis_tasks_status
  ON resource_analysis_tasks(workspace_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_resource_analysis_tasks_download
  ON resource_analysis_tasks(download_task_id);

CREATE INDEX IF NOT EXISTS idx_resource_import_tasks_status
  ON resource_import_tasks(workspace_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_resource_library_items_library
  ON resource_library_items(workspace_id, library_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_library_items_sha256
  ON resource_library_items(workspace_id, sha256) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_library_items_category
  ON resource_library_items(workspace_id, library_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_library_items_rating
  ON resource_library_items(workspace_id, rating DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_library_items_tags
  ON resource_library_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_resource_library_items_keywords
  ON resource_library_items USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_resource_library_items_search
  ON resource_library_items USING GIN(search_text);

CREATE INDEX IF NOT EXISTS idx_resource_access_logs_module
  ON resource_access_logs(workspace_id, module_id, created_at DESC);
