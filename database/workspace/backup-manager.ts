import fs from "node:fs";
import path from "node:path";

import { allWorkspaceV2Dirs } from "./layout";
import type { BackupRecord, BackupResult, RestoreResult } from "./types";

const MANIFEST = "manifest.json";

function backupRoot(root: string): string {
  return path.join(root, "backups");
}

function listBackupEntries(root: string): BackupRecord[] {
  const dir = backupRoot(root);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((n) => fs.statSync(path.join(dir, n)).isDirectory())
    .map((id) => {
      const bp = path.join(dir, id);
      const manifestPath = path.join(bp, MANIFEST);
      const raw = fs.existsSync(manifestPath)
        ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupRecord)
        : null;
      let sizeBytes = 0;
      try {
        for (const f of fs.readdirSync(bp)) {
          const st = fs.statSync(path.join(bp, f));
          if (st.isFile()) sizeBytes += st.size;
        }
      } catch {
        /* ignore */
      }
      return (
        raw ?? {
          id,
          type: "manual" as const,
          createdAt: fs.statSync(bp).mtime.toISOString(),
          path: bp,
          sizeBytes,
          manifestPath,
        }
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeManifest(record: BackupRecord): void {
  fs.writeFileSync(record.manifestPath, JSON.stringify(record, null, 2), "utf8");
}

/** 备份 workspace 元数据 + 目录清单（不复制媒体二进制，轻量备份） */
export function createWorkspaceBackup(
  workspaceRoot: string,
  configFilePath: string,
  options?: { type?: BackupRecord["type"]; incremental?: boolean }
): BackupResult {
  const type = options?.type ?? "manual";
  const id = `${type}-${Date.now()}`;
  const bp = path.join(backupRoot(workspaceRoot), id);
  fs.mkdirSync(bp, { recursive: true });

  const manifest: BackupRecord = {
    id,
    type: options?.incremental ? "incremental" : type,
    createdAt: new Date().toISOString(),
    path: bp,
    sizeBytes: 0,
    manifestPath: path.join(bp, MANIFEST),
  };

  // 复制 workspace.json + config/
  if (fs.existsSync(configFilePath)) {
    fs.copyFileSync(configFilePath, path.join(bp, "workspace.json"));
  }
  const configDir = path.join(workspaceRoot, "config");
  if (fs.existsSync(configDir)) {
    fs.cpSync(configDir, path.join(bp, "config-snapshot"), { recursive: true });
  }

  const inventory = {
    backupId: id,
    workspaceRoot,
    createdAt: manifest.createdAt,
    directories: allWorkspaceV2Dirs(workspaceRoot),
    incremental: Boolean(options?.incremental),
    note: "V2 轻量备份：元数据 + 目录清单，不含媒体二进制",
  };
  fs.writeFileSync(path.join(bp, "inventory.json"), JSON.stringify(inventory, null, 2), "utf8");

  manifest.sizeBytes = fs.statSync(path.join(bp, "inventory.json")).size;
  writeManifest(manifest);

  return { success: true, backup: manifest, message: "备份已创建（元数据 + 清单）" };
}

export function listWorkspaceBackups(workspaceRoot: string): BackupRecord[] {
  return listBackupEntries(workspaceRoot);
}

export async function restoreWorkspaceBackup(
  workspaceRoot: string,
  configFilePath: string,
  backupId: string,
  options?: { dryRun?: boolean }
): Promise<RestoreResult> {
  const bp = path.join(backupRoot(workspaceRoot), backupId);
  if (!fs.existsSync(bp)) {
    return { success: false, backupId, message: "备份不存在" };
  }

  if (options?.dryRun !== false && options?.dryRun !== undefined ? options.dryRun : true) {
    return {
      success: true,
      backupId,
      message: `[dry-run] 将从 ${bp} 恢复 workspace.json 与 config 快照`,
    };
  }

  const snapCfg = path.join(bp, "workspace.json");
  if (fs.existsSync(snapCfg)) {
    fs.copyFileSync(snapCfg, configFilePath);
  }
  const snapConfigDir = path.join(bp, "config-snapshot");
  if (fs.existsSync(snapConfigDir)) {
    fs.cpSync(snapConfigDir, path.join(workspaceRoot, "config"), { recursive: true });
  }

  return { success: true, backupId, message: "配置已从备份恢复" };
}

export function deleteWorkspaceBackup(
  workspaceRoot: string,
  backupId: string
): { success: boolean; message: string } {
  const bp = path.join(backupRoot(workspaceRoot), backupId);
  if (!fs.existsSync(bp)) return { success: false, message: "备份不存在" };
  fs.rmSync(bp, { recursive: true, force: true });
  return { success: true, message: "备份已删除" };
}

export type { BackupResult, RestoreResult };
