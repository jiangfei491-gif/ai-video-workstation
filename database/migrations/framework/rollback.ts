import fs from "node:fs";
import path from "node:path";

import { migrationSnapshotDir } from "../../repositories/shared/paths";
import { writeJsonFile } from "../../repositories/shared/json-store";
import type {
  MigrationBatchResult,
  MigrationDomain,
  MigrationPhase,
  MigrationResult,
  RollbackSnapshot,
} from "./types";

const SNAPSHOT_DIR = migrationSnapshotDir();

export function getSnapshotDir(): string {
  return SNAPSHOT_DIR;
}

export function ensureSnapshotDir(): void {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

export function createRollbackSnapshot(input: {
  batchId: string;
  phase: MigrationPhase;
  domains: MigrationDomain[];
  data: unknown;
}): RollbackSnapshot {
  ensureSnapshotDir();
  const id = `${input.batchId}-${Date.now()}`;
  const filePath = path.join(SNAPSHOT_DIR, `${id}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        id,
        batchId: input.batchId,
        phase: input.phase,
        domains: input.domains,
        createdAt: new Date().toISOString(),
        data: input.data,
      },
      null,
      2
    ),
    "utf8"
  );
  return {
    id,
    batchId: input.batchId,
    phase: input.phase,
    createdAt: new Date().toISOString(),
    path: filePath,
    domains: input.domains,
  };
}

export function loadRollbackSnapshot(snapshotId: string): {
  snapshot: RollbackSnapshot;
  data: unknown;
} | null {
  ensureSnapshotDir();
  const filePath = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    id: string;
    batchId: string;
    phase: MigrationPhase;
    domains: MigrationDomain[];
    createdAt: string;
    data: unknown;
  };
  return {
    snapshot: {
      id: raw.id,
      batchId: raw.batchId,
      phase: raw.phase,
      createdAt: raw.createdAt,
      path: filePath,
      domains: raw.domains,
    },
    data: raw.data,
  };
}

export function listRollbackSnapshots(): RollbackSnapshot[] {
  ensureSnapshotDir();
  return fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => f.endsWith(".json") && !f.startsWith("batch-"))
    .map((f) => {
      const raw = JSON.parse(
        fs.readFileSync(path.join(SNAPSHOT_DIR, f), "utf8")
      ) as RollbackSnapshot & { data?: unknown };
      return {
        id: raw.id ?? f.replace(/\.json$/, ""),
        batchId: raw.batchId ?? "",
        phase: raw.phase ?? "D2",
        createdAt: raw.createdAt ?? "",
        path: path.join(SNAPSHOT_DIR, f),
        domains: raw.domains ?? [],
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export function recordBatchResult(result: MigrationBatchResult): string {
  ensureSnapshotDir();
  const filePath = path.join(SNAPSHOT_DIR, `batch-${result.batchId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf8");
  return filePath;
}

export interface RollbackResult {
  snapshotId: string;
  success: boolean;
  message: string;
  restoredDomains: MigrationDomain[];
}

/**
 * 回滚：从快照恢复 Legacy JSON（不删除 PG 数据，不 truncate PG）
 * 默认 dry-run — 仅报告将恢复的内容
 */
export function rollbackFromSnapshot(
  snapshotId: string,
  options: { dryRun?: boolean; execute?: boolean } = {}
): RollbackResult {
  const dryRun = options.dryRun !== false && !options.execute;
  const loaded = loadRollbackSnapshot(snapshotId);

  if (!loaded) {
    return {
      snapshotId,
      success: false,
      message: "快照不存在",
      restoredDomains: [],
    };
  }

  if (dryRun) {
    return {
      snapshotId,
      success: true,
      message: `[dry-run] 将从快照 ${snapshotId} 恢复 ${loaded.snapshot.domains.join(", ")}`,
      restoredDomains: loaded.snapshot.domains,
    };
  }

  // execute=true 时写入 Legacy JSON 备份（不删 PG）
  const data = loaded.data as Record<string, unknown>;

  for (const [file, content] of Object.entries(data)) {
    if (typeof file === "string" && file.endsWith(".json")) {
      writeJsonFile(file, content);
    }
  }

  return {
    snapshotId,
    success: true,
    message: `已从快照 ${snapshotId} 恢复 Legacy JSON`,
    restoredDomains: loaded.snapshot.domains,
  };
}

export function createPreMigrationSnapshot(
  batchId: string,
  phase: MigrationPhase,
  domains: MigrationDomain[],
  legacyFiles: Record<string, unknown>
): RollbackSnapshot {
  return createRollbackSnapshot({ batchId, phase, domains, data: legacyFiles });
}

export type { MigrationResult };
