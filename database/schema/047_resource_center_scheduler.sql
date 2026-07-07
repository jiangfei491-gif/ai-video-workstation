-- =============================================================================
-- Resource Center — Crawler Scheduler（抓取调度器）
-- =============================================================================

CREATE TABLE IF NOT EXISTS resource_scheduler_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  config          JSONB NOT NULL DEFAULT '{}',
  paused          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_source_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL UNIQUE REFERENCES resource_sources(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  crawl_mode      TEXT NOT NULL DEFAULT 'auto',
  frequency       TEXT NOT NULL DEFAULT 'daily',
  custom_cron     TEXT NOT NULL DEFAULT '',
  crawl_times     TEXT[] NOT NULL DEFAULT ARRAY['02:00'],
  max_items       INT NOT NULL DEFAULT 100,
  scan_mode       TEXT NOT NULL DEFAULT 'new_only',
  priority        TEXT NOT NULL DEFAULT 'medium',
  next_run_at     TIMESTAMPTZ,
  last_run_at     TIMESTAMPTZ,
  last_sync_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_scheduler_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES resource_sources(id) ON DELETE SET NULL,
  trigger_type    TEXT NOT NULL DEFAULT 'scheduled',
  status          TEXT NOT NULL DEFAULT 'pending',
  crawler_task_id UUID REFERENCES resource_crawler_tasks(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  items_found     INT NOT NULL DEFAULT 0,
  items_failed    INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_scheduler_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_source_schedules_next
  ON resource_source_schedules(workspace_id, enabled, next_run_at)
  WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_resource_scheduler_runs_status
  ON resource_scheduler_runs(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_scheduler_logs_ws
  ON resource_scheduler_logs(workspace_id, created_at DESC);
