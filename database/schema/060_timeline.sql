-- =============================================================================
-- Timeline（时间轴）— Center/Engine 写入，OpenCut 消费
-- =============================================================================

CREATE TABLE IF NOT EXISTS timelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_version_id UUID REFERENCES artifact_versions(id) ON DELETE SET NULL,
  fps             INT NOT NULL DEFAULT 24,
  aspect_ratio    TEXT NOT NULL DEFAULT '9:16',
  duration_sec    NUMERIC(10,3) NOT NULL DEFAULT 0,
  pacing_profile  TEXT NOT NULL DEFAULT 'cinematic',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_tracks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  track           timeline_track NOT NULL,
  label           TEXT NOT NULL DEFAULT '',
  sort_order      INT NOT NULL DEFAULT 0,
  config          JSONB NOT NULL DEFAULT '{}',
  UNIQUE (timeline_id, track, sort_order)
);

CREATE TABLE IF NOT EXISTS timeline_clips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  track           timeline_track NOT NULL,
  clip_key        TEXT NOT NULL,
  start_sec       NUMERIC(10,3) NOT NULL DEFAULT 0,
  duration_sec    NUMERIC(10,3) NOT NULL DEFAULT 0,
  source_key      TEXT NOT NULL DEFAULT '',
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  label           TEXT NOT NULL DEFAULT '',
  subtitle_text   TEXT,
  subtitle_style  TEXT,
  audio_config    JSONB NOT NULL DEFAULT '{}',
  clip_spec       JSONB NOT NULL DEFAULT '{}',
  effects         JSONB NOT NULL DEFAULT '[]',
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_transitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  after_clip_id   UUID NOT NULL REFERENCES timeline_clips(id) ON DELETE CASCADE,
  transition_type TEXT NOT NULL DEFAULT 'cut',
  duration_ms     INT NOT NULL DEFAULT 0,
  rationale       TEXT NOT NULL DEFAULT '',
  payload         JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS timeline_markers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  marker_key      TEXT NOT NULL,
  time_sec        NUMERIC(10,3) NOT NULL,
  label           TEXT NOT NULL DEFAULT '',
  color           TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  UNIQUE (timeline_id, marker_key)
);

CREATE TABLE IF NOT EXISTS clip_effects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_clip_id UUID NOT NULL REFERENCES timeline_clips(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  start_sec       NUMERIC(10,3) NOT NULL DEFAULT 0,
  duration_sec    NUMERIC(10,3) NOT NULL DEFAULT 0,
  intensity       NUMERIC(6,3),
  payload         JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS script_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  shot_id         UUID REFERENCES project_shots(id) ON DELETE SET NULL,
  shot_index      INT,
  char_start      INT,
  char_end        INT,
  timeline_start_sec NUMERIC(10,3),
  source          TEXT NOT NULL DEFAULT 'storyboard'
);

-- media_pool 投影（EditGraph 兼容，指向 assets）
CREATE TABLE IF NOT EXISTS timeline_media_pool (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  pool_key        TEXT NOT NULL,
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL,
  label           TEXT NOT NULL DEFAULT '',
  origin          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'ready',
  shot_index      INT,
  text            TEXT,
  UNIQUE (timeline_id, pool_key)
);
