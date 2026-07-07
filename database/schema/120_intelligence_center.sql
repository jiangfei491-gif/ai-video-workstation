-- AI Intelligence Center（AI 技术情报中心）—— 数据库架构
-- 本阶段仅建表结构，不写入数据、不接 API。

-- 平台（12 个 Center 的静态登记）
CREATE TABLE IF NOT EXISTS ic_platforms (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name_zh       TEXT NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  entity_kind   TEXT NOT NULL,
  api_hint      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Provider（统一 Crawler Framework 的 Provider 登记）
CREATE TABLE IF NOT EXISTS ic_providers (
  slug          TEXT PRIMARY KEY,
  platform_id   TEXT NOT NULL REFERENCES ic_platforms(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  connected     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Source（统一 Source Registry，不写死）
CREATE TABLE IF NOT EXISTS ic_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id   TEXT NOT NULL REFERENCES ic_platforms(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  provider_slug TEXT NOT NULL,
  query         JSONB NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  requires_token BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crawler 任务
CREATE TABLE IF NOT EXISTS ic_crawler_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id   TEXT NOT NULL,
  source_id     UUID REFERENCES ic_sources(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  items_found   INT NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 发现的候选项目
CREATE TABLE IF NOT EXISTS ic_discovered_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id   TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  summary       TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 分析结果
CREATE TABLE IF NOT EXISTS ic_analyzer_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES ic_discovered_items(id) ON DELETE CASCADE,
  model         TEXT NOT NULL DEFAULT 'deepseek',
  summary       TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  category      TEXT,
  relevance     REAL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 升级建议
CREATE TABLE IF NOT EXISTS ic_upgrade_recommendations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID NOT NULL REFERENCES ic_discovered_items(id) ON DELETE CASCADE,
  target_module  TEXT NOT NULL,
  score          INT NOT NULL DEFAULT 0,
  worth_integrating BOOLEAN NOT NULL DEFAULT FALSE,
  recommendation TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 审核队列（必须人工确认）
CREATE TABLE IF NOT EXISTS ic_review_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES ic_upgrade_recommendations(id) ON DELETE CASCADE,
  action            TEXT NOT NULL,     -- add_project / upgrade_module / add_feature
  status            TEXT NOT NULL DEFAULT 'review', -- review / approved / rejected
  decided_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 安装任务（Git Clone / 模型 / 插件 / Workflow）
CREATE TABLE IF NOT EXISTS ic_install_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id UUID NOT NULL REFERENCES ic_review_queue(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,   -- git-clone / model / plugin / workflow
  target         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 历史
CREATE TABLE IF NOT EXISTS ic_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id   TEXT,
  kind          TEXT NOT NULL,
  ref_id        UUID,
  summary       TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 日志
CREATE TABLE IF NOT EXISTS ic_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id   TEXT,
  level         TEXT NOT NULL DEFAULT 'info',
  message       TEXT NOT NULL,
  at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 设置（单行全局配置）
CREATE TABLE IF NOT EXISTS ic_settings (
  id                    INT PRIMARY KEY DEFAULT 1,
  auto_advise           BOOLEAN NOT NULL DEFAULT TRUE,
  require_human_review  BOOLEAN NOT NULL DEFAULT TRUE,
  default_analyzer_model TEXT NOT NULL DEFAULT 'deepseek',
  min_score_to_recommend INT NOT NULL DEFAULT 60,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ic_sources_platform ON ic_sources(platform_id);
CREATE INDEX IF NOT EXISTS idx_ic_crawler_platform ON ic_crawler_tasks(platform_id, status);
CREATE INDEX IF NOT EXISTS idx_ic_items_platform ON ic_discovered_items(platform_id);
CREATE INDEX IF NOT EXISTS idx_ic_review_status ON ic_review_queue(status);
