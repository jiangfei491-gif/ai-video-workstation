#!/usr/bin/env bash
# AI Video OS — 部署 Fish Speech / CosyVoice（官方 Docker + 标准桥接）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TTS_DIR="$ROOT/services/tts"
ENV_FILE="$ROOT/.env.local"
STATE_FILE="$ROOT/services/tts/.deploy-state.env"
AI_OS_ROOT="${AI_VIDEO_OS_ROOT:-$HOME/AI Video OS}"

mkdir -p "$AI_OS_ROOT/models/fishspeech" "$AI_OS_ROOT/models/cosyvoice"

FISH_UPSTREAM_PORT="${FISH_SPEECH_UPSTREAM_PORT:-8080}"
FISH_BRIDGE_PORT="${FISH_SPEECH_BRIDGE_PORT:-19080}"
COSY_UPSTREAM_PORT="${COSYVOICE_UPSTREAM_PORT:-50000}"
COSY_BRIDGE_PORT="${COSYVOICE_BRIDGE_PORT:-19081}"

log() { echo "[deploy-tts] $*"; }

find_free_port() {
  local start=$1
  local port=$start
  while lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
  done
  echo "$port"
}

if lsof -iTCP:"$FISH_BRIDGE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  FISH_BRIDGE_PORT="$(find_free_port "$FISH_BRIDGE_PORT")"
fi

export FISH_SPEECH_UPSTREAM_PORT="$FISH_UPSTREAM_PORT"
export FISH_SPEECH_BRIDGE_PORT="$FISH_BRIDGE_PORT"
export COSYVOICE_UPSTREAM_PORT="$COSY_UPSTREAM_PORT"
export COSYVOICE_BRIDGE_PORT="$COSY_BRIDGE_PORT"

log "==> 拉取 Fish Speech 官方 CPU 镜像..."
docker pull fishaudio/fish-speech:server-cpu

mkdir -p "$TTS_DIR/checkpoints" "$TTS_DIR/references"

if [[ ! -f "$TTS_DIR/checkpoints/openaudio-s1-mini/codec.pth" ]] && \
   [[ ! -f "$TTS_DIR/checkpoints/openaudio-s1-mini/codec.pth.incomplete" ]]; then
  log "==> 下载 Fish Speech 官方模型 openaudio-s1-mini（需 HuggingFace 授权）..."
  HF_TOKEN_ARG=""
  if [[ -f "$ENV_FILE" ]]; then
    HF_TOKEN_VAL="$(grep -E '^HF_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' || true)"
    [[ -n "$HF_TOKEN_VAL" ]] && HF_TOKEN_ARG="-e HF_TOKEN=$HF_TOKEN_VAL"
  fi
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download fishaudio/openaudio-s1-mini \
      --local-dir "$TTS_DIR/checkpoints/openaudio-s1-mini" || true
  elif command -v hf >/dev/null 2>&1; then
    hf download fishaudio/openaudio-s1-mini \
      --local-dir "$TTS_DIR/checkpoints/openaudio-s1-mini" || true
  else
    log "==> 使用 ModelScope 下载模型（国内源，无需 HuggingFace 授权）..."
    docker run --rm \
      -v "$TTS_DIR/checkpoints:/out" \
      python:3.11-slim bash -c \
      'pip install -q modelscope && python -c "
from modelscope import snapshot_download
snapshot_download(\"fishaudio/openaudio-s1-mini\", local_dir=\"/out/openaudio-s1-mini\")
"' || {
      log "ModelScope 失败，尝试 HuggingFace..."
      docker run --rm \
        -v "$TTS_DIR/checkpoints:/out" \
        $HF_TOKEN_ARG \
        python:3.11-slim bash -c \
        'pip install -q huggingface_hub && python -c "
import os
from huggingface_hub import snapshot_download
snapshot_download(\"fishaudio/openaudio-s1-mini\", local_dir=\"/out/openaudio-s1-mini\", token=os.environ.get(\"HF_TOKEN\") or None)
"' || log "WARN: 模型下载失败"
    }
  fi
fi

if [[ -f "$TTS_DIR/checkpoints/openaudio-s1-mini/codec.pth" ]]; then
  MODEL_OK=1
  log "模型已就绪: openaudio-s1-mini"
else
  MODEL_OK=0
  log "WARN: 模型未完整下载，Fish Speech 可能无法合成"
fi

log "==> 启动 Fish Speech + Bridge..."
cd "$TTS_DIR"
docker compose up -d fish-speech fish-bridge --build

COSY_BUILT=0
COSY_RUNNING=0
if [[ "${DEPLOY_COSYVOICE:-1}" == "1" ]]; then
  if docker image inspect cosyvoice:v1.0 >/dev/null 2>&1; then
    log "CosyVoice 镜像已存在"
    COSY_BUILT=1
  else
    log "==> 构建 CosyVoice 官方 Docker 镜像（首次较慢）..."
    COSY_REPO="$TTS_DIR/repos/CosyVoice"
    if [[ ! -d "$COSY_REPO/.git" ]]; then
      git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git "$COSY_REPO"
      git -C "$COSY_REPO" submodule update --init --recursive || true
    fi
    if docker build -t cosyvoice:v1.0 "$COSY_REPO/runtime/python" 2>&1; then
      COSY_BUILT=1
    else
      log "WARN: CosyVoice Docker 构建失败（Mac 无 NVIDIA 时常见），跳过 CosyVoice"
    fi
  fi
  if [[ "$COSY_BUILT" == "1" ]]; then
    docker compose --profile cosyvoice up -d cosyvoice cosy-bridge --build || true
    COSY_RUNNING=1
  fi
fi

probe_url() {
  local url=$1
  curl -sf -m 5 "$url" >/dev/null 2>&1
}

wait_health() {
  local url=$1
  local label=$2
  local i
  for i in $(seq 1 60); do
    if probe_url "$url"; then
      log "$label 健康检查通过: $url"
      return 0
    fi
    sleep 5
  done
  return 1
}

FISH_BRIDGE_URL="http://127.0.0.1:${FISH_BRIDGE_PORT}"
FISH_HEALTH_URL="${FISH_BRIDGE_URL}/health"
FISH_DOCS_URL="${FISH_BRIDGE_URL}/docs"
FISH_UPSTREAM_HEALTH="http://127.0.0.1:${FISH_UPSTREAM_PORT}/v1/health"
FISH_UPSTREAM_DOCS="http://127.0.0.1:${FISH_UPSTREAM_PORT}/docs"

FISH_OK=0
if wait_health "$FISH_HEALTH_URL" "Fish Speech Bridge"; then
  FISH_OK=1
elif wait_health "$FISH_UPSTREAM_HEALTH" "Fish Speech 官方"; then
  FISH_BRIDGE_URL="http://127.0.0.1:${FISH_UPSTREAM_PORT}"
  FISH_HEALTH_URL="${FISH_UPSTREAM_HEALTH}"
  FISH_DOCS_URL="${FISH_UPSTREAM_DOCS}"
  FISH_OK=1
fi

COSY_BRIDGE_URL="http://127.0.0.1:${COSY_BRIDGE_PORT}"
COSY_HEALTH_URL="${COSY_BRIDGE_URL}/health"
COSY_DOCS_URL="${COSY_BRIDGE_URL}/docs"
COSY_UPSTREAM_DOCS="http://127.0.0.1:${COSY_UPSTREAM_PORT}/docs"

COSY_OK=0
if [[ "$COSY_RUNNING" == "1" ]]; then
  if wait_health "$COSY_HEALTH_URL" "CosyVoice Bridge"; then
    COSY_OK=1
  elif curl -sf -m 5 "$COSY_UPSTREAM_DOCS" >/dev/null 2>&1; then
    COSY_BRIDGE_URL="http://127.0.0.1:${COSY_UPSTREAM_PORT}"
    COSY_HEALTH_URL="${COSY_BRIDGE_URL}/docs"
    COSY_DOCS_URL="${COSY_UPSTREAM_DOCS}"
    COSY_OK=1
  fi
fi

update_env() {
  local key=$1
  local val=$2
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    fi
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

if [[ "$FISH_OK" == "1" ]]; then
  update_env "FISH_SPEECH_ENDPOINT" "$FISH_BRIDGE_URL"
  log "已写入 FISH_SPEECH_ENDPOINT=$FISH_BRIDGE_URL"
fi

if [[ "$COSY_OK" == "1" ]]; then
  update_env "COSYVOICE_ENDPOINT" "$COSY_BRIDGE_URL"
  log "已写入 COSYVOICE_ENDPOINT=$COSY_BRIDGE_URL"
else
  if grep -q "^COSYVOICE_ENDPOINT=" "$ENV_FILE" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' 's|^COSYVOICE_ENDPOINT=.*|# COSYVOICE_ENDPOINT=  # 未部署，运行 DEPLOY_COSYVOICE=1 bash scripts/deploy-local-tts.sh|' "$ENV_FILE"
    else
      sed -i 's|^COSYVOICE_ENDPOINT=.*|# COSYVOICE_ENDPOINT=  # 未部署|' "$ENV_FILE"
    fi
  fi
fi

# 合成 smoke test
SYNTH_OK=0
if [[ "$FISH_OK" == "1" ]]; then
  if curl -sf -m 120 -X POST "${FISH_BRIDGE_URL%/}/synthesize" \
    -H "Content-Type: application/json" \
    -d '{"text":"AI Video OS 部署测试"}' \
    -o /tmp/fish-test.wav && [[ -s /tmp/fish-test.wav ]]; then
    SYNTH_OK=1
    log "Fish Speech 合成测试成功 (/tmp/fish-test.wav)"
  else
    log "WARN: Fish Speech 合成测试未通过（模型可能仍在加载）"
  fi
fi

cat > "$STATE_FILE" <<EOF
FISH_SPEECH_INSTALLED=$([[ "$FISH_OK" == "1" ]] && echo yes || echo no)
COSYVOICE_INSTALLED=$([[ "$COSY_OK" == "1" ]] && echo yes || echo no)
FISH_SPEECH_UPSTREAM_PORT=$FISH_UPSTREAM_PORT
FISH_SPEECH_BRIDGE_PORT=$FISH_BRIDGE_PORT
FISH_SPEECH_ENDPOINT=$FISH_BRIDGE_URL
FISH_HEALTH=$FISH_HEALTH_URL
FISH_DOCS=$FISH_DOCS_URL
COSYVOICE_UPSTREAM_PORT=$COSY_UPSTREAM_PORT
COSYVOICE_BRIDGE_PORT=$COSY_BRIDGE_PORT
COSYVOICE_ENDPOINT=$COSY_BRIDGE_URL
COSY_HEALTH=$COSY_HEALTH_URL
COSY_DOCS=$COSY_DOCS_URL
SYNTH_TEST=$([[ "$SYNTH_OK" == "1" ]] && echo yes || echo no)
EOF

echo ""
echo "========== 部署报告 =========="
echo "① Fish Speech: $([[ "$FISH_OK" == "1" ]] && echo 成功 || echo 失败/加载中)"
echo "② CosyVoice:   $([[ "$COSY_OK" == "1" ]] && echo 成功 || echo 未部署/失败)"
echo "③ 模型:        $([[ "${MODEL_OK:-0}" == "1" ]] && echo openaudio-s1-mini 已下载 || echo 未完整/需 HuggingFace)"
echo "④ Fish 上游端口: $FISH_UPSTREAM_PORT | 桥接端口: $FISH_BRIDGE_PORT"
echo "⑤ Fish Endpoint: $FISH_BRIDGE_URL"
echo "⑥ Fish Health:   $FISH_HEALTH_URL"
echo "⑦ Fish Docs:     $FISH_DOCS_URL"
echo "⑧ 合成测试:      $([[ "$SYNTH_OK" == "1" ]] && echo 通过 || echo 待模型就绪后重试)"
echo "⑨ .env.local:    $([[ "$FISH_OK" == "1" || "$COSY_OK" == "1" ]] && echo 已更新 || echo 未更新)"
echo "⑩ 配音中心:      重启 npm run dev 后查看 /voice-center"
echo "=============================="
