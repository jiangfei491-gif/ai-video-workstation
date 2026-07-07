-- AI Cut V1 — 初始化（按顺序执行 schema/*.sql）
-- 用法: psql $DATABASE_URL -f database/schema/000_init.sql

\echo 'AI Cut V1 schema init...'

\ir 001_extensions.sql
\ir 002_schema_migrations.sql
\ir 010_identity.sql
\ir 020_registry.sql
\ir 030_project.sql
\ir 040_library.sql
\ir 045_resource_center_phase2.sql
\ir 046_resource_center_phase3.sql
\ir 047_resource_center_scheduler.sql
\ir 050_assets.sql
\ir 060_timeline.sql
\ir 070_execution.sql
\ir 080_qa.sql
\ir 090_export.sql
\ir 100_cost.sql
\ir 110_logs.sql
\ir 999_indexes.sql

\echo 'AI Cut V1 schema complete.'
