import type { WorkspaceRelocateResult } from "./types";
import { resolveAbsolute, writeGlobalPointer } from "./workspace-core";

/**
 * Workspace 路径迁移 — 仅修改指针，不复制业务数据。
 *
 * 用户需自行将 `AI Video OS/` 文件夹移动到新位置（NAS / SSD / 新电脑），
 * 然后调用此方法更新路径。
 */
export function relocateWorkspacePathOnly(
  currentRoot: string,
  newRoot: string,
  saveConfig: (root: string) => void
): WorkspaceRelocateResult {
  const absNew = resolveAbsolute(newRoot);
  const absOld = resolveAbsolute(currentRoot);

  if (absNew === absOld) {
    return {
      success: true,
      oldRoot: absOld,
      newRoot: absNew,
      message: "路径未变化",
      dataCopied: false,
    };
  }

  writeGlobalPointer(absNew);
  saveConfig(absNew);

  return {
    success: true,
    oldRoot: absOld,
    newRoot: absNew,
    message:
      "路径已更新。请将 AI Video OS 文件夹物理移动到新位置后重启。未复制任何业务数据。",
    dataCopied: false,
  };
}
