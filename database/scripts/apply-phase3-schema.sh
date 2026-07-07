#!/usr/bin/env bash
# Resource Center Phase 3 — AI Analyzer / Library Items
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Applying Phase 3 schema..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/046_resource_center_phase3.sql

echo "==> Phase 3 DB ready."
