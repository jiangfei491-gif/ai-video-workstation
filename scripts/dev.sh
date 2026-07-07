#!/usr/bin/env bash
# 启动工作台 + 后台拉起内嵌 OpenCut
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v docker >/dev/null 2>&1; then
  bash scripts/opencut-zh/setup.sh >/tmp/opencut-vendor.log 2>&1 &
fi

exec npx next dev --hostname 0.0.0.0
