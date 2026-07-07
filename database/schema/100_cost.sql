-- =============================================================================
-- Cost
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  category        TEXT NOT NULL,
  agent_slug      CITEXT,
  center_slug     CITEXT,
  provider_slug   CITEXT,
  model_slug      CITEXT,
  input_tokens    BIGINT NOT NULL DEFAULT 0,
  output_tokens   BIGINT NOT NULL DEFAULT 0,
  calls           INT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(12,6) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_stats_daily (
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stat_date       DATE NOT NULL,
  provider_slug   CITEXT NOT NULL DEFAULT 'all',
  input_tokens    BIGINT NOT NULL DEFAULT 0,
  output_tokens   BIGINT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(12,6) NOT NULL DEFAULT 0,
  requests        INT NOT NULL DEFAULT 0,
  successes       INT NOT NULL DEFAULT 0,
  errors          INT NOT NULL DEFAULT 0,
  last_model      TEXT,
  PRIMARY KEY (workspace_id, stat_date, provider_slug)
);

-- JSON 兼容层映射（legacy id 对照，不迁移数据，仅第二阶段双写用）
CREATE TABLE IF NOT EXISTS legacy_json_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,
  legacy_key      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, legacy_key, entity_type)
);
