#!/usr/bin/env bash
# Resource Center Phase 2 — Schema + Seed
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Applying Phase 2 schema..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/045_resource_center_phase2.sql

echo "==> Seeding default resource sources..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /seeders/002_resource_sources.sql

echo "==> Phase 2 DB ready."
