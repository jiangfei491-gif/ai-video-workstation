#!/bin/bash
# V3 本地工作台停止
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT" 2>/dev/null || true

# shellcheck disable=SC1091
source "$PROJECT/scripts/_workstation-common.sh"

echo "AI结束 — 停止本地工作台"
stop_all_next_instances
echo "完成。"

if [ -t 0 ]; then
  read -r -p "按回车键关闭…" _
fi
