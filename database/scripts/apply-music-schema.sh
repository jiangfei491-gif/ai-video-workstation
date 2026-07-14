#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/130_music_lyrics.sql
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/131_music_zh_remark.sql
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/132_music_commercial_score.sql
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/133_music_seed_tracks.sql
docker compose exec -T postgres psql -U ai_cut -d ai_cut_v1 -v ON_ERROR_STOP=1 -f /schema/134_music_imported_seeds.sql
