-- =============================================================================
-- Execution（执行）— Jobs / Workflow / Artifact 产物
-- Director Plan / EditGraph / ClipIntent 存 artifact_versions（kind 见 artifact_registry）
-- =============================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  job_type        CITEXT NOT NULL,
  status          job_status NOT NULL DEFAULT 'pending',
  priority        INT NOT NULL DEFAULT 0,
  progress        NUMERIC(5,2) NOT NULL DEFAULT 0,
  message         TEXT NOT NULL DEFAULT '',
  input           JSONB NOT NULL DEFAULT '{}',
  output          JSONB NOT NULL DEFAULT '{}',
  error           JSONB NOT NULL DEFAULT '{}',
  parent_job_id   UUID REFERENCES jobs(id) ON DELETE SET NULL,
  agent_slug      CITEXT,
  center_slug     CITEXT,
  provider_slug   CITEXT,
  model_slug      CITEXT,
  workflow_run_id UUID,
  legacy_source   TEXT,
  legacy_id       TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step_index      INT NOT NULL,
  name            TEXT NOT NULL,
  status          job_status NOT NULL DEFAULT 'pending',
  message         TEXT NOT NULL DEFAULT '',
  payload         JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  UNIQUE (job_id, step_index)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_slug   CITEXT NOT NULL,
  workflow_version INT NOT NULL DEFAULT 1,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status          job_status NOT NULL DEFAULT 'pending',
  current_node_key TEXT,
  context         JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_run_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_key        TEXT NOT NULL,
  event           TEXT NOT NULL,
  message         TEXT NOT NULL DEFAULT '',
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clip Agent 执行批次
CREATE TABLE IF NOT EXISTS clip_agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  director_plan_artifact_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status          job_status NOT NULL DEFAULT 'pending',
  command_count   INT NOT NULL DEFAULT 0,
  trace           JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error           TEXT
);

CREATE TABLE IF NOT EXISTS clip_agent_commands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_agent_run_id UUID NOT NULL REFERENCES clip_agent_runs(id) ON DELETE CASCADE,
  seq             INT NOT NULL,
  command_type    TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',
  applied_at      TIMESTAMPTZ,
  UNIQUE (clip_agent_run_id, seq)
);

-- Clip Intent 规范化行（摘要；完整 payload 在 artifact_versions kind=clip_intent）
CREATE TABLE IF NOT EXISTS clip_intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE SET NULL,
  shot_index      INT NOT NULL,
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  start_sec       NUMERIC(10,3) NOT NULL DEFAULT 0,
  duration_sec    NUMERIC(10,3) NOT NULL,
  transition_after JSONB NOT NULL DEFAULT '{}',
  rationale       TEXT NOT NULL DEFAULT '',
  tags            TEXT[] NOT NULL DEFAULT '{}'
);

-- Director Plan 摘要行（完整 JSON 在 artifact_versions kind=director_plan）
CREATE TABLE IF NOT EXISTS director_plan_clips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_version_id UUID NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
  clip_intent_id  TEXT NOT NULL,
  shot_index      INT NOT NULL,
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  start_sec       NUMERIC(10,3) NOT NULL DEFAULT 0,
  duration_sec    NUMERIC(10,3) NOT NULL,
  transition_after JSONB NOT NULL DEFAULT '{}',
  rationale       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS director_plan_subtitles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_version_id UUID NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  start_sec       NUMERIC(10,3) NOT NULL,
  duration_sec    NUMERIC(10,3) NOT NULL,
  shot_index      INT,
  style           TEXT NOT NULL DEFAULT 'default'
);

-- OpenCut 工程快照
CREATE TABLE IF NOT EXISTS opencut_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  timeline_id     UUID REFERENCES timelines(id) ON DELETE SET NULL,
  artifact_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL,
  project_json    JSONB NOT NULL DEFAULT '{}',
  exported_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  locale          TEXT NOT NULL DEFAULT 'zh',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Edit Plan 变体（多方案对比）
CREATE TABLE IF NOT EXISTS edit_plan_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  artifact_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  pacing_profile  TEXT NOT NULL DEFAULT 'cinematic',
  sequence_payload JSONB NOT NULL DEFAULT '{}',
  rationale       JSONB NOT NULL DEFAULT '{}',
  model_slug      CITEXT,
  usage           JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
