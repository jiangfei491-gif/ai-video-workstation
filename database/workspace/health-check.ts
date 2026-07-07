import fs from "node:fs";
import path from "node:path";

import { allWorkspaceV2Dirs } from "./layout";
import type { DirCheckResult, HealthCheckItem, WorkspaceHealthReport } from "./types";

function dirExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function dirWritable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function dirSizeBytes(root: string, depth = 3): number {
  if (!dirExists(root)) return 0;
  let total = 0;
  const walk = (dir: string, d: number) => {
    if (d < 0) return;
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      try {
        const st = fs.statSync(fp);
        if (st.isFile()) total += st.size;
        else if (st.isDirectory()) walk(fp, d - 1);
      } catch {
        /* skip */
      }
    }
  };
  walk(root, depth);
  return total;
}

function diskSpace(root: string): { free?: number; total?: number } {
  try {
    fs.statfsSync(root);
    // Node 18+ statfs - use fallback if unavailable
  } catch {
    /* ignore */
  }
  return {};
}

export function checkAndRepairDirs(
  root: string,
  options?: { includeProjectId?: string; repair?: boolean }
): DirCheckResult {
  const expected = allWorkspaceV2Dirs(root, options?.includeProjectId);
  const missing: string[] = [];
  const created: string[] = [];

  for (const dir of expected) {
    if (!dirExists(dir)) {
      missing.push(dir);
      if (options?.repair !== false) {
        fs.mkdirSync(dir, { recursive: true });
        created.push(dir);
      }
    }
  }

  return { missing, created, ok: missing.length === 0 || created.length === missing.length };
}

export async function runWorkspaceHealthCheck(
  roots: Record<string, string>
): Promise<WorkspaceHealthReport> {
  const items: HealthCheckItem[] = [];
  const root = roots.workspaceRoot;

  const areas: Array<{ area: string; path: string }> = [
    { area: "database", path: roots.databaseRoot },
    { area: "storage", path: roots.storageRoot },
    { area: "library", path: roots.libraryRoot },
    { area: "models", path: roots.modelRoot },
    { area: "logs", path: roots.logRoot },
    { area: "backups", path: roots.backupRoot },
    { area: "cache", path: roots.cacheRoot },
    { area: "exports", path: roots.exportRoot },
  ];

  for (const { area, path: p } of areas) {
    if (!dirExists(p)) {
      items.push({ area, status: "error", message: "目录缺失", path: p });
    } else if (!dirWritable(p)) {
      items.push({ area, status: "error", message: "无写权限", path: p });
    } else {
      items.push({ area, status: "ok", message: "正常", path: p });
    }
  }

  // workspace.json
  const cfgPath = roots.configFilePath;
  if (!fs.existsSync(cfgPath)) {
    items.push({ area: "config", status: "warning", message: "workspace.json 缺失", path: cfgPath });
  } else {
    items.push({ area: "config", status: "ok", message: "workspace.json 存在", path: cfgPath });
  }

  const disk = diskSpace(root);
  const hasError = items.some((i) => i.status === "error");

  return {
    ok: !hasError,
    checkedAt: new Date().toISOString(),
    workspaceRoot: root,
    diskFreeBytes: disk.free,
    diskTotalBytes: disk.total,
    items,
  };
}

export function scanDirectorySize(root: string, maxDepth = 2): Record<string, number> {
  const result: Record<string, number> = {};
  if (!dirExists(root)) return result;

  for (const name of fs.readdirSync(root)) {
    const fp = path.join(root, name);
    if (fs.statSync(fp).isDirectory()) {
      result[name] = dirSizeBytes(fp, maxDepth);
    }
  }
  return result;
}

export function removeDirectoryContents(dir: string, dryRun: boolean): { removed: string[]; freedBytes: number } {
  const removed: string[] = [];
  let freedBytes = 0;
  if (!dirExists(dir)) return { removed, freedBytes };

  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    try {
      const st = fs.statSync(fp);
      if (st.isFile()) freedBytes += st.size;
      if (!dryRun) {
        fs.rmSync(fp, { recursive: true, force: true });
      }
      removed.push(fp);
    } catch {
      /* skip */
    }
  }
  return { removed, freedBytes };
}
