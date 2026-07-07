-- =============================================================================
-- Registry（注册中心）— 扩展仅 INSERT，禁止 ALTER 核心业务表
-- =============================================================================

-- Agent Registry
CREATE TABLE IF NOT EXISTS agent_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'execute',
  description     TEXT NOT NULL DEFAULT '',
  capabilities    JSONB NOT NULL DEFAULT '{}',
  default_model_slug   CITEXT,
  default_provider_slug CITEXT,
  is_system       BOOLEAN NOT NULL DEFAULT TRUE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Center Registry
CREATE TABLE IF NOT EXISTS center_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  route           TEXT,
  bound_agent_slug CITEXT,
  description     TEXT NOT NULL DEFAULT '',
  capabilities    JSONB NOT NULL DEFAULT '{}',
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Provider Registry
CREATE TABLE IF NOT EXISTS provider_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  kind            TEXT NOT NULL,
  adapter         TEXT NOT NULL DEFAULT '',
  config_schema   JSONB NOT NULL DEFAULT '{}',
  priority        INT NOT NULL DEFAULT 0,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  health_status   TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Model Registry（Model Center）
CREATE TABLE IF NOT EXISTS model_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug   CITEXT NOT NULL,
  model_key       CITEXT NOT NULL,
  display_name    TEXT NOT NULL,
  modality        TEXT NOT NULL,
  capabilities    JSONB NOT NULL DEFAULT '{}',
  pricing         JSONB NOT NULL DEFAULT '{}',
  default_params  JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_deprecated   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_slug, model_key)
);

-- Workflow Registry
CREATE TABLE IF NOT EXISTS workflow_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  scope           TEXT NOT NULL DEFAULT 'platform',
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  description     TEXT NOT NULL DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_registry_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES workflow_registry(id) ON DELETE CASCADE,
  node_key        TEXT NOT NULL,
  node_type       TEXT NOT NULL,
  ref_slug        CITEXT,
  ref_type        TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  position        JSONB NOT NULL DEFAULT '{}',
  UNIQUE (workflow_id, node_key)
);

CREATE TABLE IF NOT EXISTS workflow_registry_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES workflow_registry(id) ON DELETE CASCADE,
  from_node_id    UUID NOT NULL REFERENCES workflow_registry_nodes(id) ON DELETE CASCADE,
  to_node_id      UUID NOT NULL REFERENCES workflow_registry_nodes(id) ON DELETE CASCADE,
  condition       JSONB NOT NULL DEFAULT '{}',
  label           TEXT NOT NULL DEFAULT ''
);

-- Pipeline Registry（14 步流水线）
CREATE TABLE IF NOT EXISTS pipeline_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_slug      CITEXT NOT NULL UNIQUE,
  stage_order     INT NOT NULL,
  display_name    TEXT NOT NULL,
  short_label     TEXT NOT NULL DEFAULT '',
  owner           TEXT NOT NULL,
  center_slug     CITEXT,
  module_slug     CITEXT,
  description     TEXT NOT NULL DEFAULT '',
  implementation  JSONB NOT NULL DEFAULT '[]',
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Module Registry（产品模块对照）
CREATE TABLE IF NOT EXISTS module_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  overall_lead    TEXT NOT NULL DEFAULT '',
  ai_lead_slug    CITEXT,
  engines         TEXT NOT NULL DEFAULT '',
  responsibilities TEXT NOT NULL DEFAULT '',
  implementation  JSONB NOT NULL DEFAULT '[]',
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Engine Registry（Rule Engine / Render Engine 等）
CREATE TABLE IF NOT EXISTS engine_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  kind            TEXT NOT NULL,
  center_slug     CITEXT,
  description     TEXT NOT NULL DEFAULT '',
  capabilities    JSONB NOT NULL DEFAULT '{}',
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Job Registry（任务类型）
CREATE TABLE IF NOT EXISTS job_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  category        TEXT NOT NULL,
  default_timeout_sec INT,
  is_async        BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Template Kind Registry
CREATE TABLE IF NOT EXISTS template_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  schema          JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Resource Type Registry（Library 资源类型）
CREATE TABLE IF NOT EXISTS resource_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  payload_schema  JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Artifact Kind Registry（可版本产物）
CREATE TABLE IF NOT EXISTS artifact_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  payload_schema  JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Integration Registry（第三方平台）
CREATE TABLE IF NOT EXISTS integration_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  platform        TEXT NOT NULL,
  config_schema   JSONB NOT NULL DEFAULT '{}',
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Capability Registry（I/O Schema）
CREATE TABLE IF NOT EXISTS capability_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  input_schema    JSONB NOT NULL DEFAULT '{}',
  output_schema   JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Permission Registry（权限定义）
CREATE TABLE IF NOT EXISTS permission_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Provider 凭证（Workspace 级，加密由应用层处理）
CREATE TABLE IF NOT EXISTS provider_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_slug   CITEXT NOT NULL,
  encrypted_secret TEXT NOT NULL DEFAULT '',
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider_slug)
);
