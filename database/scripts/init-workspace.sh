#!/usr/bin/env bash
# 初始化 AI Video OS 工作区目录结构（不迁移、不删除旧数据）
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${AI_VIDEO_OS_ROOT:-}" ]] || [[ -n "${WORKSPACE_ROOT:-}" ]]; then
  export AI_VIDEO_OS_ROOT="${AI_VIDEO_OS_ROOT:-${WORKSPACE_ROOT:-}}"
fi

npx tsx -e "
import { getWorkspaceManager, resetWorkspaceManager } from './workspace/index.ts';
resetWorkspaceManager();
const ws = getWorkspaceManager();
ws.ensureLayout();
console.log('Workspace Root:', ws.workspaceRoot);
console.log('Config:', ws.getPaths().configFilePath);
console.log('Legacy JSON (read-only):', ws.legacyProductionJsonDir());
console.log('Done — no migration, no deletion.');
"
