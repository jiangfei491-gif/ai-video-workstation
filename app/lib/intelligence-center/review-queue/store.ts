import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { writeJsonAtomic } from "../paths";
import type { IcDiscoveredItem, IcPlatformId } from "../types";
import type { InstallKind } from "../installer/git-install";

/**
 * 审核队列的持久化存储（JSON 文件，落在 AI-Veo 同一个家里，重启不丢）。
 * 与情报中心其它内存注册表不同：审核/安装是人工决策工作流，必须持久。
 */

export type IcReviewStatus =
  | "review"
  | "approved"
  | "rejected"
  | "installing"
  | "installed"
  | "failed";

export type IcReviewAction = "add_project" | "upgrade_module" | "add_feature";

export interface IcInstallState {
  kind: InstallKind;
  gitUrl?: string;
  path?: string;
  status: "pending" | "installing" | "installed" | "failed";
  log?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface IcReviewRecord {
  id: string;
  platformId: IcPlatformId;
  item: IcDiscoveredItem;
  score: number;
  module: string;
  worth: boolean;
  reason: string;
  tags: string[];
  scoredBy: string;
  action: IcReviewAction;
  status: IcReviewStatus;
  decidedBy?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  install?: IcInstallState;
}

function storeFile(): string {
  const root =
    process.env.AI_VIDEO_OS_ROOT?.trim() ||
    process.env.WORKSPACE_ROOT?.trim() ||
    path.join(homedir(), "AI-Veo");
  return path.join(root, "intelligence-center", "review-queue.json");
}

function loadAll(): IcReviewRecord[] {
  const f = storeFile();
  if (!existsSync(f)) return [];
  try {
    const parsed = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(parsed) ? (parsed as IcReviewRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAll(records: IcReviewRecord[]): void {
  writeJsonAtomic(storeFile(), records);
}

export function listRecords(status?: IcReviewStatus): IcReviewRecord[] {
  const all = loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return status ? all.filter((r) => r.status === status) : all;
}

export function getRecord(id: string): IcReviewRecord | undefined {
  return loadAll().find((r) => r.id === id);
}

/** 新增或按 id 更新 */
export function upsertRecord(rec: IcReviewRecord): IcReviewRecord {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === rec.id);
  if (idx >= 0) all[idx] = rec;
  else all.push(rec);
  saveAll(all);
  return rec;
}

export function updateRecord(id: string, patch: Partial<IcReviewRecord>): IcReviewRecord | null {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  saveAll(all);
  return all[idx];
}

export function removeRecord(id: string): boolean {
  const all = loadAll();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  saveAll(next);
  return true;
}
