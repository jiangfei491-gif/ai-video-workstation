#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OPENCUT_DIR="$ROOT/vendor/opencut"

if [ -d "$OPENCUT_DIR" ]; then
  cd "$OPENCUT_DIR"
  docker compose down
  echo "✅ 内嵌 OpenCut 已停止"
else
  echo "ℹ️  vendor/opencut 不存在，无需停止"
fi
