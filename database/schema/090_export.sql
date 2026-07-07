-- =============================================================================
-- Export
-- =============================================================================

CREATE TABLE IF NOT EXISTS export_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  export_type     TEXT NOT NULL,
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  settings        JSONB NOT NULL DEFAULT '{}',
  status          job_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- 发布记录（预留）
CREATE TABLE IF NOT EXISTS publish_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  export_record_id UUID REFERENCES export_records(id) ON DELETE SET NULL,
  integration_slug CITEXT NOT NULL,
  platform        TEXT NOT NULL,
  status          job_status NOT NULL DEFAULT 'pending',
  external_id     TEXT,
  publish_url     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
