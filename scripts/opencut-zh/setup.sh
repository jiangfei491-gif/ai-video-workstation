#!/usr/bin/env bash
# 内嵌 OpenCut 中文版：clone 到 vendor/opencut 并用 Docker 启动
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OPENCUT_DIR="$ROOT/vendor/opencut"
REPO="${OPENCUT_VENDOR_REPO:-https://github.com/shuishen49/OpenCut.git}"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ 需要 Docker（可用 brew install colima docker docker-compose 后 colima start）"
  exit 1
fi

mkdir -p "$ROOT/vendor"

if [ ! -d "$OPENCUT_DIR/.git" ]; then
  echo "📦 正在拉取 OpenCut 到 vendor/opencut …"
  git clone --depth 1 "$REPO" "$OPENCUT_DIR"
fi

# 占位环境变量：上传/转写功能用不到，仅为通过 next build 的环境校验
DOCKERFILE="$OPENCUT_DIR/apps/web/Dockerfile"
if [ -f "$DOCKERFILE" ] && ! grep -q "build-placeholder" "$DOCKERFILE"; then
  echo "🔧 注入构建期占位环境变量 …"
  python3 - "$DOCKERFILE" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
anchor = "WORKDIR /app/apps/web\nRUN bun run build"
inject = (
    'ENV CLOUDFLARE_ACCOUNT_ID="build-placeholder"\n'
    'ENV R2_ACCESS_KEY_ID="build-placeholder"\n'
    'ENV R2_SECRET_ACCESS_KEY="build-placeholder"\n'
    'ENV R2_BUCKET_NAME="build-placeholder"\n'
    'ENV MODAL_TRANSCRIPTION_URL="https://build-placeholder.invalid"\n\n'
)
if anchor in s and "build-placeholder" not in s:
    s = s.replace(anchor, inject + anchor, 1)
    open(p, "w", encoding="utf-8").write(s)
PY
fi

# 空 .env 避免可选变量警告
: > "$OPENCUT_DIR/.env"

echo "🚀 正在构建并启动内嵌 OpenCut（首次约 10–25 分钟）…"
cd "$OPENCUT_DIR"
docker compose up -d --build

echo ""
echo "✅ 内嵌 OpenCut 已就绪：http://localhost:3100/projects"
