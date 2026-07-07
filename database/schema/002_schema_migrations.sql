-- =============================================================================
-- Schema Migration 追踪表（M0）
-- 所有后续 DDL 变更必须写入 migrations/schema/ 并在此登记
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version         TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  checksum        TEXT,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE schema_migrations IS '数据库结构迁移版本追踪；禁止手动改库不登记';
