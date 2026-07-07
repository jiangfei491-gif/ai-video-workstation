-- =============================================================================
-- Project（项目）— 系统业务锚点
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title                       TEXT NOT NULL DEFAULT '',
  topic                       TEXT NOT NULL DEFAULT '',
  status                      lifecycle_status NOT NULL DEFAULT 'draft',
  pipeline_mode               TEXT NOT NULL DEFAULT 't2v',
  workspace_mode              TEXT NOT NULL DEFAULT 'default',
  generation_mode             TEXT NOT NULL DEFAULT 'test',
  source_material_id          UUID,
  source_script               TEXT,
  source_script_label         TEXT,
  target_duration_minutes     INT,
  active_timeline_id          UUID,
  active_director_plan_artifact_id UUID,
  active_edit_graph_artifact_id    UUID,
  final_video_asset_id        UUID,
  active_workflow_run_id      UUID,
  legacy_history_entry_id     TEXT,
  created_by                  UUID REFERENCES users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_settings (
  project_id                  UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  shot_count                  INT NOT NULL DEFAULT 8,
  shot_duration_sec           NUMERIC(8,2) NOT NULL DEFAULT 5,
  fps                         INT NOT NULL DEFAULT 24,
  aspect_ratio                TEXT NOT NULL DEFAULT '9:16',
  custom_aspect_ratio         TEXT,
  clarity                     TEXT NOT NULL DEFAULT '1080p',
  custom_clarity_width        INT,
  custom_clarity_height       INT,
  seed_mode                   TEXT NOT NULL DEFAULT 'auto',
  seed                        BIGINT,
  character_consistency       BOOLEAN NOT NULL DEFAULT TRUE,
  scene_consistency           BOOLEAN NOT NULL DEFAULT TRUE,
  project_style               TEXT NOT NULL DEFAULT '',
  style_preset_id             TEXT,
  camera_template_id          TEXT,
  project_bible               JSONB NOT NULL DEFAULT '{}',
  world_bible                 JSONB NOT NULL DEFAULT '{}',
  consistency_settings        JSONB NOT NULL DEFAULT '{}',
  edit_engine_settings        JSONB NOT NULL DEFAULT '{}',
  edit_voice_id               TEXT NOT NULL DEFAULT '',
  edit_bgm_volume             NUMERIC(4,3) NOT NULL DEFAULT 0.3,
  edit_render_mode            TEXT NOT NULL DEFAULT 'mixed',
  pacing_profile              TEXT NOT NULL DEFAULT 'cinematic',
  active_shot_idx             INT NOT NULL DEFAULT 0,
  canvas_ui                   JSONB NOT NULL DEFAULT '{}',
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 项目 ↔ Library 资源引用（角色/场景/道具等）
CREATE TABLE IF NOT EXISTS project_resources (
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_type   CITEXT NOT NULL,
  resource_id     UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'reference',
  sort_order      INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, resource_type, resource_id)
);

-- 项目 ↔ 统一 Asset 关联
CREATE TABLE IF NOT EXISTS project_assets (
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'media',
  label           TEXT NOT NULL DEFAULT '',
  origin          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'ready',
  shot_index      INT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, asset_id)
);

-- 可版本产物容器（Director Plan / EditGraph / ClipIntent trace 等）
CREATE TABLE IF NOT EXISTS project_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_kind   CITEXT NOT NULL,
  slug            TEXT NOT NULL DEFAULT 'default',
  active_version_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, artifact_kind, slug)
);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id     UUID NOT NULL REFERENCES project_artifacts(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  summary         JSONB NOT NULL DEFAULT '{}',
  parent_version_id UUID REFERENCES artifact_versions(id),
  source          TEXT NOT NULL DEFAULT 'system',
  source_job_id   UUID,
  message         TEXT NOT NULL DEFAULT '',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artifact_id, version)
);

-- Workbench 客户端会话（仅存 UI + projectId + syncVersion）
CREATE TABLE IF NOT EXISTS workbench_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  ui_state        JSONB NOT NULL DEFAULT '{}',
  current_page    TEXT NOT NULL DEFAULT '',
  layout          JSONB NOT NULL DEFAULT '{}',
  sync_version    BIGINT NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Center / Agent 运行时配置与状态（挂 Project）
CREATE TABLE IF NOT EXISTS center_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_slug     CITEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'project',
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  config          JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS center_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  center_slug     CITEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'idle',
  current_job_id  UUID,
  state           JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, center_slug)
);

CREATE TABLE IF NOT EXISTS agent_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug      CITEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'project',
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  config          JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_slug      CITEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'idle',
  current_job_id  UUID,
  state           JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, agent_slug)
);

CREATE TABLE IF NOT EXISTS agent_prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug      CITEXT NOT NULL,
  prompt_slug     CITEXT NOT NULL DEFAULT 'system',
  scope           TEXT NOT NULL DEFAULT 'platform',
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  active_version_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_prompt_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_prompt_id UUID NOT NULL REFERENCES agent_prompts(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  content         TEXT NOT NULL,
  variables       JSONB NOT NULL DEFAULT '{}',
  model_slug      CITEXT,
  changelog       TEXT NOT NULL DEFAULT '',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_prompt_id, version)
);

-- 稳定镜头 ID（替代 shotIndex 作为主键）
CREATE TABLE IF NOT EXISTS project_shots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_index      INT NOT NULL,
  scene_number    INT,
  duration_sec    NUMERIC(8,2),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, shot_index)
);

-- 编导状态（title + script，分镜细节在 library/storyboard 或 artifact）
CREATE TABLE IF NOT EXISTS project_director_state (
  project_id      UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  script          TEXT NOT NULL DEFAULT '',
  visual_settings JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 画布布局
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_key        TEXT NOT NULL,
  node_type       TEXT NOT NULL,
  x               NUMERIC NOT NULL DEFAULT 0,
  y               NUMERIC NOT NULL DEFAULT 0,
  payload         JSONB NOT NULL DEFAULT '{}',
  UNIQUE (project_id, node_key)
);

CREATE TABLE IF NOT EXISTS canvas_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  edge_key        TEXT NOT NULL,
  from_key        TEXT NOT NULL,
  to_key          TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  UNIQUE (project_id, edge_key)
);

CREATE TABLE IF NOT EXISTS canvas_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_key     TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT '',
  x               NUMERIC NOT NULL DEFAULT 0,
  y               NUMERIC NOT NULL DEFAULT 0,
  w               NUMERIC NOT NULL DEFAULT 0,
  h               NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (project_id, section_key)
);
