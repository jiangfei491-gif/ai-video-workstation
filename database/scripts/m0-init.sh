#!/usr/bin/env bash
# AI Cut V1 — M0 数据库初始化（Schema + Registry Seed）
# 用法: bash database/scripts/m0-init.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Starting PostgreSQL (docker compose)..."
docker compose up -d postgres

echo "==> Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U ai_cut -d ai_cut_v1 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose exec -T postgres pg_isready -U ai_cut -d ai_cut_v1

echo "==> Applying Schema (000_init.sql)..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/000_init.sql

echo "==> Recording baseline migration M000..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -c \
  "INSERT INTO schema_migrations (version, name, checksum)
   VALUES ('M000', 'baseline', '000_init.sql')
   ON CONFLICT (version) DO NOTHING;"

echo "==> Seeding Registry (001_registry.sql)..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /seeders/001_registry.sql

echo "==> M0 init complete."
echo ""
echo "DATABASE_URL=postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1"
