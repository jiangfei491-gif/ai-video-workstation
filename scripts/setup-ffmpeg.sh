#!/usr/bin/env bash
# 安装现代 ffmpeg 到 vendor/ffmpeg/（AI 剪辑转场 xfade 需要 4.3+；自带的 @ffmpeg-installer 是 2018 老版，无 xfade）。
# vendor/ffmpeg 不进 git，所以新机器首次需跑一次本脚本，或改用系统 ffmpeg。
# 用法: bash scripts/setup-ffmpeg.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$ROOT/vendor/ffmpeg"
DEST="$DEST_DIR/ffmpeg"

# 已有可用且支持 xfade 的就跳过
if [ -x "$DEST" ] && "$DEST" -hide_banner -filters 2>/dev/null | grep -qw xfade; then
  echo "✅ vendor ffmpeg 已就绪且支持 xfade：$DEST"
  exit 0
fi

# 系统已装现代 ffmpeg（含 xfade）也行，runner 会自动优先它
if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -hide_banner -filters 2>/dev/null | grep -qw xfade; then
  echo "✅ 系统 ffmpeg 已支持 xfade（$(command -v ffmpeg)），无需 vendor 版。"
  exit 0
fi

OS="$(uname -s)"
if [ "$OS" != "Darwin" ]; then
  echo "⚠️ 本脚本目前只自动下 macOS 版。其它系统请：装系统 ffmpeg(4.3+) 或设 FFMPEG_PATH 指向现代 ffmpeg。"
  echo "   Linux 例: sudo apt install ffmpeg  或下 https://johnvansickle.com/ffmpeg/ 静态版"
  exit 1
fi

echo "下载现代 ffmpeg（evermeet.cx，含 xfade）…"
mkdir -p "$DEST_DIR"
TMP="$(mktemp -d)"
curl -sL --max-time 120 -o "$TMP/ffmpeg.zip" "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
unzip -o -q "$TMP/ffmpeg.zip" -d "$TMP/extract"
BIN="$(find "$TMP/extract" -name ffmpeg -type f | head -1)"
[ -n "$BIN" ] || { echo "❌ 解压未找到 ffmpeg"; exit 1; }
cp "$BIN" "$DEST"
chmod +x "$DEST"
rm -rf "$TMP"

if "$DEST" -hide_banner -filters 2>/dev/null | grep -qw xfade; then
  echo "✅ 安装完成：$DEST （$("$DEST" -version 2>/dev/null | head -1)）"
else
  echo "❌ 装好了但没检测到 xfade，请检查版本"
  exit 1
fi
