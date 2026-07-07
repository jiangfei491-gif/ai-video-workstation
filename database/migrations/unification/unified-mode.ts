import fs from "node:fs";
import path from "node:path";

import { getWorkspaceManager } from "../../workspace";
import type { WorkspaceConfigFile } from "../../workspace/types";

export function isWorkspaceUnified(): boolean {
  return true;
}

export function getUnifiedDefaultProjectId(): string | null {
  try {
    const cfg = getWorkspaceManager().loadConfig() as WorkspaceConfigFile & {
      defaultProjectId?: string;
    };
    return cfg.defaultProjectId ?? null;
  } catch {
    return null;
  }
}

export function markWorkspaceUnified(meta: {
  defaultWorkspaceId: string;
  defaultProjectId: string;
  migratedAt: string;
  reportPath: string;
}): void {
  const ws = getWorkspaceManager();
  const current = ws.loadConfig();
  const settingsDefaults = {
    autoBackupEnabled: false,
    autoBackupIntervalHours: 24,
    autoInitOnStartup: true,
    autoRepairMissingDirs: true,
  };
  ws.saveConfig({
    ...current,
    unified: true,
    defaultWorkspaceId: meta.defaultWorkspaceId,
    defaultProjectId: meta.defaultProjectId,
    settings: {
      ...settingsDefaults,
      ...current.settings,
      unified: true,
      unifiedAt: meta.migratedAt,
      migrationReportPath: meta.reportPath,
    },
  });
}

export function libraryJsonBackupPath(filename: string): string {
  const ws = getWorkspaceManager();
  const lib = ws.getLibraryPaths();
  const map: Record<string, string> = {
    "materials.json": path.join(lib.materials, "materials.json"),
    "characters.json": path.join(lib.characters, "characters.json"),
    "scenes.json": path.join(lib.scenes, "scenes.json"),
    "props.json": path.join(lib.props, "props.json"),
    "image-assets.json": path.join(lib.materials, "image-assets.json"),
    "material-schedules.json": path.join(lib.materials, "material-schedules.json"),
    "shot-locks.json": path.join(lib.materials, "shot-locks.json"),
    "auto-edit-jobs.json": path.join(lib.materials, "auto-edit-jobs.json"),
    "script-evolution-runs.json": path.join(lib.materials, "script-evolution-runs.json"),
    "script-evolution-script-records.json": path.join(lib.materials, "script-evolution-script-records.json"),
    "script-evolution-score-records.json": path.join(lib.materials, "script-evolution-score-records.json"),
  };
  return map[filename] ?? path.join(lib.materials, filename);
}

export function ensureLibraryJsonBackupDir(filename: string): string {
  const fp = libraryJsonBackupPath(filename);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  return fp;
}
