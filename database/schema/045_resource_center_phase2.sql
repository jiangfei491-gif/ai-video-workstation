-- =============================================================================
-- Resource Center Phase 2 — Source / Crawler / Downloader
-- =============================================================================

CREATE TABLE IF NOT EXISTS resource_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  url                 TEXT NOT NULL DEFAULT '',
  resource_types      TEXT[] NOT NULL DEFAULT '{}',
  site_category       TEXT NOT NULL DEFAULT '',
  country             TEXT NOT NULL DEFAULT '',
  language            TEXT NOT NULL DEFAULT 'zh',
  license_type        TEXT NOT NULL DEFAULT '',
  license             TEXT NOT NULL DEFAULT '',
  api_url             TEXT NOT NULL DEFAULT '',
  rss_url             TEXT NOT NULL DEFAULT '',
  requires_login      BOOLEAN NOT NULL DEFAULT FALSE,
  requires_api_key    BOOLEAN NOT NULL DEFAULT FALSE,
  supports_crawler    BOOLEAN NOT NULL DEFAULT TRUE,
  supports_downloader BOOLEAN NOT NULL DEFAULT TRUE,
  provider_slug       CITEXT NOT NULL DEFAULT 'generic-http',
  crawl_frequency     TEXT NOT NULL DEFAULT 'manual',
  last_crawled_at     TIMESTAMPTZ,
  last_updated_at     TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active',
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT NOT NULL DEFAULT '',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS resource_crawler_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES resource_sources(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
  progress        JSONB NOT NULL DEFAULT '{}',
  queue_position  INT,
  pages_total     INT,
  pages_done      INT NOT NULL DEFAULT 0,
  items_found     INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  paused_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_crawler_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES resource_crawler_tasks(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_download_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id         UUID REFERENCES resource_sources(id) ON DELETE SET NULL,
  crawler_task_id   UUID REFERENCES resource_crawler_tasks(id) ON DELETE SET NULL,
  remote_url        TEXT NOT NULL,
  local_path        TEXT NOT NULL DEFAULT '',
  filename          TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending',
  bytes_total       BIGINT,
  bytes_downloaded  BIGINT NOT NULL DEFAULT 0,
  sha256_expected   CHAR(64),
  sha256_actual     CHAR(64),
  speed_bps         BIGINT,
  retry_count       INT NOT NULL DEFAULT 0,
  max_retries       INT NOT NULL DEFAULT 3,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_download_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES resource_download_tasks(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_sources_workspace ON resource_sources(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_sources_enabled ON resource_sources(workspace_id, enabled) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_crawler_tasks_source ON resource_crawler_tasks(source_id, status);
CREATE INDEX IF NOT EXISTS idx_resource_crawler_tasks_queue ON resource_crawler_tasks(status, queue_position);
CREATE INDEX IF NOT EXISTS idx_resource_download_tasks_status ON resource_download_tasks(status, created_at);
