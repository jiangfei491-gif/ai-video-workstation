#!/bin/bash
# 绕过 uv run（避免每次启动重拉 CUDA 依赖），直接使用镜像内 CPU venv
set -euo pipefail

LLAMA="${LLAMA_CHECKPOINT_PATH:-checkpoints/openaudio-s1-mini}"
DECODER="${DECODER_CHECKPOINT_PATH:-checkpoints/openaudio-s1-mini/codec.pth}"
DECODER_CFG="${DECODER_CONFIG_NAME:-modded_dac_vq}"
HOST="${API_SERVER_NAME:-0.0.0.0}"
PORT="${API_SERVER_PORT:-8080}"

echo "[fish-start] listen=${HOST}:${PORT} llama=${LLAMA}"

exec /app/.venv/bin/python tools/api_server.py \
  --listen "${HOST}:${PORT}" \
  --llama-checkpoint-path "${LLAMA}" \
  --decoder-checkpoint-path "${DECODER}" \
  --decoder-config-name "${DECODER_CFG}" \
  --device cpu
