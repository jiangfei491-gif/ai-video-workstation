/**
 * Repository 路径 — 全部委托 WorkspaceManager
 */

import path from "node:path";

import { getWorkspaceManager } from "../../workspace";

const ws = () => getWorkspaceManager();

export function ensureDesktopVeoLayout(): void {
  ws().ensureLayout();
}

export function productionJsonPath(name: string): string {
  return ws().libraryJsonPath(name);
}

export function dataJsonPath(name: string): string {
  return path.join(ws().databaseRoot, "runtime", name);
}

export function migrationSnapshotDir(): string {
  return path.join(ws().databaseRoot, "backups", "migration-snapshots");
}
