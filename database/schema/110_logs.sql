-- =============================================================================
-- Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  module          TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'running',
  message         TEXT NOT NULL DEFAULT '',
  agent_slug      CITEXT,
  center_slug     CITEXT,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS center_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  center_slug     CITEXT NOT NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  level           TEXT NOT NULL DEFAULT 'info',
  message         TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_slug      CITEXT NOT NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  level           TEXT NOT NULL DEFAULT 'info',
  event           TEXT NOT NULL DEFAULT '',
  message         TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 项目历史快照（替代 localStorage history）
CREATE TABLE IF NOT EXISTS project_history_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL DEFAULT 'video',
  topic           TEXT NOT NULL DEFAULT '',
  thumbnail_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  snapshot        JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'completed',
  legacy_entry_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户 / 模块 UI 偏好（替代 localStorage center ui-settings）
CREATE TABLE IF NOT EXISTS module_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  module          TEXT NOT NULL,
  settings        JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, workspace_id, module)
);
