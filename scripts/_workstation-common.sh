#!/bin/bash
# 共享：停止所有本地 Next.js 实例
set -euo pipefail

stop_all_next_instances() {
  local stopped=0

  echo "正在停止旧 Next.js 实例…"

  if pkill -f "${PROJECT}/node_modules/.bin/next dev" 2>/dev/null; then
    stopped=1
    echo "已停止 next dev 进程"
  fi

  if pkill -f "next-server" 2>/dev/null; then
    stopped=1
    echo "已停止 next-server 进程"
  fi

  local port
  for port in $(seq 3000 3010); do
    local pids
    pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
      stopped=1
      echo "已释放端口 ${port}"
    fi
  done

  sleep 1

  if [ "$stopped" -eq 0 ]; then
    echo "未发现运行中的 Next.js 实例"
  else
    echo "旧实例已全部停止"
  fi
}

get_lan_ip() {
  local iface ip
  for iface in en0 en1 bridge0; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [ -n "$ip" ]; then
      echo "$ip"
      return 0
    fi
  done
  return 1
}

wait_for_next_port() {
  local log_file="$1"
  local max_wait="${2:-90}"
  local i port

  for i in $(seq 1 "$max_wait"); do
    if grep -qE 'Local:[[:space:]]+http://localhost:[0-9]+' "$log_file" 2>/dev/null; then
      port=$(grep -oE 'localhost:[0-9]+' "$log_file" | head -1 | cut -d: -f2)
      if [ -n "$port" ]; then
        echo "$port"
        return 0
      fi
    fi
    if grep -qiE 'error|failed to start|EADDRINUSE' "$log_file" 2>/dev/null; then
      if ! grep -qE 'Local:[[:space:]]+http://localhost:[0-9]+' "$log_file" 2>/dev/null; then
        return 1
      fi
    fi
    sleep 1
  done
  return 1
}
