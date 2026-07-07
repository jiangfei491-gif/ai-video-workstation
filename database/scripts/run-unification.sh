#!/usr/bin/env bash
# Workspace 数据归一迁移 — 复制 Legacy 文件 + 导入 PostgreSQL + 标记 unified
set -euo pipefail
cd "$(dirname "$0")/../.."

export AI_CUT_MIGRATION_EXECUTE=true
export WORKBENCH_EXPORT_PATH="${WORKBENCH_EXPORT_PATH:-}"

npx tsx database/migrations/unification/cli.ts "$@"
