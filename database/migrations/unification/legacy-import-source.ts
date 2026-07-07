import os from "node:os";
import path from "node:path";

import { resolveAbsolute } from "../../workspace";

/**
 * 一次性迁移脚本专用：Legacy Desktop 源路径。
 * 运行时模块禁止引用；仅 `migrate:*` CLI 使用。
 */
export function legacyImportSourceRoot(): string {
  const env = process.env.LEGACY_IMPORT_SOURCE_ROOT;
  if (env?.trim()) return resolveAbsolute(env);
  return path.join(os.homedir(), "Desktop", "AI-Veo");
}

export function legacyImportProjectsDir(): string {
  return path.join(legacyImportSourceRoot(), "Projects");
}
