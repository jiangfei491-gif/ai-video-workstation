-- =============================================================================
-- Music Lyrics Module（最终版）— 仅两个功能：公版歌词 + 原创歌词
-- 独立模块，不影响视频/导演/时间轴流程
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 清理旧版本（本模块无历史数据，安全重建）
DROP TABLE IF EXISTS
  music_public_lyric_content,
  music_public_lyric_reviews,
  music_public_lyric_fingerprints,
  music_public_lyric_versions,
  music_public_lyric_evidence,
  music_public_discoveries,
  music_public_lyrics,
  music_crawl_tasks,
  music_original_lyric_scores,
  music_original_lyric_versions,
  music_original_lyrics,
  music_module_roles,
  music_operation_logs,
  music_sources
  CASCADE;

-- 存储文件索引（原始网页/正文/证据；仅存路径/大小/类型/指纹）
CREATE TABLE IF NOT EXISTS music_storage_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  relative_path   TEXT NOT NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  sha256          CHAR(64) NOT NULL,
  is_immutable    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_storage_files_ws ON music_storage_files(workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_music_storage_files_sha ON music_storage_files(sha256);

-- 系统设置（定时同步频率等）
CREATE TABLE IF NOT EXISTS music_settings (
  workspace_id    UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  settings        JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 公版歌词库（GPT 全自动发现/抓取/解析/分类/标记后直接入库）
CREATE TABLE IF NOT EXISTS music_public_lyrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  title_zh        TEXT NOT NULL DEFAULT '',
  author          TEXT NOT NULL DEFAULT '',
  birth_year      INT,
  death_year      INT,
  country         TEXT NOT NULL DEFAULT '',
  language        TEXT NOT NULL DEFAULT '',
  first_published TEXT NOT NULL DEFAULT '',
  source_url      TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '其它',
  mood_tags       TEXT[] NOT NULL DEFAULT '{}',
  scene_tags      TEXT[] NOT NULL DEFAULT '{}',
  style_tags      TEXT[] NOT NULL DEFAULT '{}',
  theme_tags      TEXT[] NOT NULL DEFAULT '{}',
  content_preview TEXT NOT NULL DEFAULT '',
  lyric_zh_remark TEXT NOT NULL DEFAULT '',
  content_file_id UUID REFERENCES music_storage_files(id) ON DELETE SET NULL,
  raw_html_file_id UUID REFERENCES music_storage_files(id) ON DELETE SET NULL,
  dedupe_key      TEXT NOT NULL,
  fingerprint     CHAR(64) NOT NULL DEFAULT '',
  synced_by       TEXT NOT NULL DEFAULT 'gpt',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_ws ON music_public_lyrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_cat ON music_public_lyrics(workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_mood ON music_public_lyrics USING GIN(mood_tags);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_scene ON music_public_lyrics USING GIN(scene_tags);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_style ON music_public_lyrics USING GIN(style_tags);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_theme ON music_public_lyrics USING GIN(theme_tags);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_title_trgm ON music_public_lyrics USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_music_public_lyrics_author_trgm ON music_public_lyrics USING GIN(author gin_trgm_ops);

-- 公版歌词证据（原始网页/来源截图等文件；后台自动保存，无独立页面）
CREATE TABLE IF NOT EXISTS music_public_lyric_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lyric_id        UUID NOT NULL REFERENCES music_public_lyrics(id) ON DELETE CASCADE,
  evidence_type   TEXT NOT NULL DEFAULT 'source',
  title           TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  file_id         UUID REFERENCES music_storage_files(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_evidence_lyric ON music_public_lyric_evidence(lyric_id);

-- 同步记录（GPT 定时/手动同步的执行日志）
CREATE TABLE IF NOT EXISTS music_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trigger         TEXT NOT NULL DEFAULT 'manual',
  status          TEXT NOT NULL DEFAULT 'running',
  found_count     INT NOT NULL DEFAULT 0,
  added_count     INT NOT NULL DEFAULT 0,
  skipped_count   INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  model           TEXT NOT NULL DEFAULT '',
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_music_sync_runs_ws ON music_sync_runs(workspace_id, started_at DESC);

-- 原创歌词（用户提示词 → GPT 创作）
CREATE TABLE IF NOT EXISTS music_original_lyrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '未命名',
  title_zh        TEXT NOT NULL DEFAULT '',
  language        TEXT NOT NULL DEFAULT 'zh',
  prompt          JSONB NOT NULL DEFAULT '{}',
  content_preview TEXT NOT NULL DEFAULT '',
  lyric_zh_remark TEXT NOT NULL DEFAULT '',
  content_file_id UUID REFERENCES music_storage_files(id) ON DELETE SET NULL,
  current_version_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_original_lyrics_ws ON music_original_lyrics(workspace_id, updated_at DESC);

-- 原创歌词历史版本（重新生成/继续/修改都新建版本，禁止覆盖）
CREATE TABLE IF NOT EXISTS music_original_lyric_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lyric_id        UUID NOT NULL REFERENCES music_original_lyrics(id) ON DELETE CASCADE,
  version_no      INT NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  content_preview TEXT NOT NULL DEFAULT '',
  content_file_id UUID REFERENCES music_storage_files(id) ON DELETE SET NULL,
  created_by      TEXT NOT NULL DEFAULT 'gpt',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lyric_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_music_original_versions_lyric ON music_original_lyric_versions(lyric_id, version_no DESC);
