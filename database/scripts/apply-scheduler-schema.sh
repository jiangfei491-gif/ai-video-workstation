#!/usr/bin/env bash
# Resource Center — Crawler Scheduler Schema
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Applying Scheduler schema..."
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/047_resource_center_scheduler.sql

echo "==> Scheduler DB ready."
