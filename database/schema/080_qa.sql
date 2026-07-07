-- =============================================================================
-- QA
-- =============================================================================

CREATE TABLE IF NOT EXISTS qa_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  artifact_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL,
  overall_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  ai_assessment   JSONB NOT NULL DEFAULT '{}',
  exported_video_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  timeline_summary JSONB NOT NULL DEFAULT '{}',
  retry_targets   JSONB NOT NULL DEFAULT '[]',
  approved        BOOLEAN,
  report_markdown TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_report_id    UUID NOT NULL REFERENCES qa_reports(id) ON DELETE CASCADE,
  dimension       TEXT NOT NULL,
  score           NUMERIC(5,2) NOT NULL,
  weight          NUMERIC(4,3) NOT NULL DEFAULT 1,
  metadata        JSONB NOT NULL DEFAULT '{}',
  UNIQUE (qa_report_id, dimension)
);

CREATE TABLE IF NOT EXISTS qa_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_report_id    UUID NOT NULL REFERENCES qa_reports(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  category        TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'warning',
  message         TEXT NOT NULL,
  clip_id         UUID,
  shot_index      INT
);

CREATE TABLE IF NOT EXISTS qa_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_report_id    UUID REFERENCES qa_reports(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  level           TEXT NOT NULL DEFAULT 'info',
  message         TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
