#!/bin/bash
# V3 本地工作台启动 — 先停旧实例，再检测实际端口并打开浏览器
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${TMPDIR:-/tmp}/ai-workspace-dev.log"

cd "$PROJECT" || exit 1

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' .env.local | sed 's/^/export /')
  set +a
fi

# shellcheck disable=SC1091
source "$PROJECT/scripts/_workstation-common.sh"

stop_all_next_instances

echo "AI启动 — 本地工作台"
echo "项目: $PROJECT"

: > "$LOG_FILE"

npm run dev 2>&1 | tee "$LOG_FILE" &
DEV_PID=$!

cleanup() {
  kill "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

PORT=""
if PORT=$(wait_for_next_port "$LOG_FILE" 90); then
  URL="http://localhost:${PORT}/ai-video"
  echo "Next.js 就绪"
  echo "  电脑: $URL"
  LAN_IP=""
  if LAN_IP=$(get_lan_ip); then
    echo "  手机（同一 WiFi）: http://${LAN_IP}:${PORT}/ai-video"
  else
    echo "  手机: 未能获取局域网 IP，请在终端查看 Network 地址"
  fi
  open "$URL"
else
  echo "错误: 未能检测到 Next.js 监听端口"
  echo "--- 最近日志 ---"
  tail -30 "$LOG_FILE"
  exit 1
fi

wait "$DEV_PID"
