#!/usr/bin/env bash
# 等待 codec.pth 下载完成后重启 Fish Speech 并验证
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TTS_DIR="$ROOT/services/tts"
CODEC="$TTS_DIR/checkpoints/openaudio-s1-mini/codec.pth"
BRIDGE_PORT="${FISH_SPEECH_BRIDGE_PORT:-19080}"
BRIDGE_URL="http://127.0.0.1:${BRIDGE_PORT}"

log() { echo "[finish-codec] $(date +%H:%M:%S) $*"; }

log "等待 codec.pth 下载完成..."
while [[ ! -f "$CODEC" ]]; do
  if [[ -f "${CODEC}.incomplete" ]]; then
    sz=$(stat -f%z "${CODEC}.incomplete" 2>/dev/null || stat -c%s "${CODEC}.incomplete" 2>/dev/null || echo 0)
    log "下载中: $(( sz / 1024 / 1024 )) MB / ~1870 MB"
  fi
  sleep 30
done

log "codec.pth 就绪，重启 Fish Speech..."
cd "$TTS_DIR"
docker compose restart fish-speech
sleep 10

log "等待上游健康..."
for i in $(seq 1 40); do
  if curl -sf -m 5 "http://127.0.0.1:8080/v1/health" >/dev/null 2>&1; then
    log "Fish 上游 OK"
    break
  fi
  sleep 15
done

log "等待桥接健康..."
for i in $(seq 1 20); do
  status=$(curl -sf -m 5 "${BRIDGE_URL}/health" 2>/dev/null || echo "")
  if echo "$status" | grep -q '"status":"ok"'; then
    log "桥接 OK: $status"
    break
  fi
  log "桥接状态: ${status:-无响应}"
  sleep 10
done

log "合成测试..."
if curl -sf -m 180 -X POST "${BRIDGE_URL}/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"AI Video OS 部署测试"}' \
  -o /tmp/fish-test.wav && [[ -s /tmp/fish-test.wav ]]; then
  log "合成成功: /tmp/fish-test.wav ($(wc -c </tmp/fish-test.wav) bytes)"
else
  log "WARN: 合成测试失败"
fi

# 更新 .env.local
ENV_FILE="$ROOT/.env.local"
if grep -q "^FISH_SPEECH_ENDPOINT=" "$ENV_FILE" 2>/dev/null; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^FISH_SPEECH_ENDPOINT=.*|FISH_SPEECH_ENDPOINT=${BRIDGE_URL}|" "$ENV_FILE"
  else
    sed -i "s|^FISH_SPEECH_ENDPOINT=.*|FISH_SPEECH_ENDPOINT=${BRIDGE_URL}|" "$ENV_FILE"
  fi
else
  echo "FISH_SPEECH_ENDPOINT=${BRIDGE_URL}" >> "$ENV_FILE"
fi

log "完成。请重启 npm run dev 并在 /voice-center 验证 Fish Speech。"
