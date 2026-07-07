-- =============================================================================
-- Library（资源库）— Workspace 级可复用内容（非二进制，二进制走 assets）
-- =============================================================================

-- 素材库
CREATE TABLE IF NOT EXISTS materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  language        TEXT,
  content_type    TEXT,
  truth_lock      INT,
  lock_fields     JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT '待分析',
  favorite        BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_json_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS material_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     UUID NOT NULL UNIQUE REFERENCES materials(id) ON DELETE CASCADE,
  summary         TEXT NOT NULL DEFAULT '',
  analysis        JSONB NOT NULL DEFAULT '{}',
  score           NUMERIC(4,2),
  model_slug      CITEXT,
  usage           JSONB NOT NULL DEFAULT '{}',
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_scripts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  script          TEXT NOT NULL DEFAULT '',
  duration_minutes INT,
  language        TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  evolution_record_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  task            TEXT NOT NULL DEFAULT '',
  config          JSONB NOT NULL DEFAULT '{}',
  last_run_at     TIMESTAMPTZ,
  last_result     JSONB NOT NULL DEFAULT '{}',
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 脚本进化（Library 扩展）
CREATE TABLE IF NOT EXISTS script_evolution_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  material_id     UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
  config          JSONB NOT NULL DEFAULT '{}',
  result          JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS script_evolution_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_run_id UUID NOT NULL REFERENCES script_evolution_runs(id) ON DELETE CASCADE,
  material_id     UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  provider_slug   CITEXT,
  model_slug      CITEXT,
  script          TEXT,
  scores          JSONB NOT NULL DEFAULT '{}',
  cost            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 角色 / 场景 / 道具（Library 实体，类型也在 resource_registry）
CREATE TABLE IF NOT EXISTS characters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            CITEXT NOT NULL,
  appearance      TEXT NOT NULL DEFAULT '',
  payload         JSONB NOT NULL DEFAULT '{}',
  ref_asset_id    UUID,
  legacy_json_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS scenes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            CITEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  payload         JSONB NOT NULL DEFAULT '{}',
  ref_asset_id    UUID,
  legacy_json_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS props (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            CITEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  payload         JSONB NOT NULL DEFAULT '{}',
  ref_asset_id    UUID,
  legacy_json_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (workspace_id, name)
);

-- Prompt 库
CREATE TABLE IF NOT EXISTS prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL DEFAULT 'image',
  content         TEXT NOT NULL,
  model_slug      CITEXT,
  provider_slug   CITEXT,
  version         INT NOT NULL DEFAULT 1,
  source          TEXT NOT NULL DEFAULT 'user',
  parent_id       UUID REFERENCES prompts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 模板库（统一 templates，kind 来自 template_registry）
CREATE TABLE IF NOT EXISTS templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  template_kind   CITEXT NOT NULL,
  slug            CITEXT NOT NULL,
  name            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  active_version_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, template_kind, slug)
);

CREATE TABLE IF NOT EXISTS template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  changelog       TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version)
);

-- 音乐库（元数据，文件 → assets）
CREATE TABLE IF NOT EXISTS music_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  asset_id        UUID,
  style           TEXT,
  bpm             INT,
  duration_sec    NUMERIC(8,2),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 特效/转场库（元数据）
CREATE TABLE IF NOT EXISTS effects_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'transition',
  slug            CITEXT NOT NULL,
  name            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, kind, slug)
);

-- 音色库
CREATE TABLE IF NOT EXISTS voice_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_slug   CITEXT NOT NULL,
  voice_id        TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT '',
  language        TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  is_system       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider_slug, voice_id)
);

-- 字幕样式/动画库
CREATE TABLE IF NOT EXISTS subtitle_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'style',
  slug            CITEXT NOT NULL,
  name            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, kind, slug)
);

-- 术语库
CREATE TABLE IF NOT EXISTS glossaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'default',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS glossary_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  glossary_id     UUID NOT NULL REFERENCES glossaries(id) ON DELETE CASCADE,
  term            TEXT NOT NULL,
  do_not_translate BOOLEAN NOT NULL DEFAULT FALSE,
  translations    JSONB NOT NULL DEFAULT '{}',
  UNIQUE (glossary_id, term)
);

-- 分镜表（Library 与 Project 交界，按 project 存储）
CREATE TABLE IF NOT EXISTS storyboard_shots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE SET NULL,
  shot_index      INT NOT NULL,
  scene_number    INT,
  duration_sec    NUMERIC(8,2),
  character       TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL DEFAULT '',
  environment     TEXT NOT NULL DEFAULT '',
  camera          TEXT NOT NULL DEFAULT '',
  narration       TEXT NOT NULL DEFAULT '',
  consistency_meta JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, shot_index)
);

CREATE TABLE IF NOT EXISTS provider_prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE SET NULL,
  shot_index      INT NOT NULL,
  provider_prompt TEXT NOT NULL DEFAULT '',
  duration_sec    NUMERIC(8,2),
  consistency_meta JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, shot_index)
);

-- Shot Lock
CREATE TABLE IF NOT EXISTS shot_locks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE CASCADE,
  shot_index      INT NOT NULL,
  snapshot        JSONB NOT NULL DEFAULT '{}',
  production_task_id TEXT,
  production_clip_asset_id UUID,
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, shot_index)
);

-- 一致性时间轴条目
CREATE TABLE IF NOT EXISTS shot_timeline_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE CASCADE,
  shot_index      INT NOT NULL,
  delta           JSONB NOT NULL DEFAULT '{}',
  memory          JSONB NOT NULL DEFAULT '{}',
  qc_result       JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, shot_index)
);
