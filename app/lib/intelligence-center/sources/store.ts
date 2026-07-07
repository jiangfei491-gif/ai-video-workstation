import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { icDataDir, writeJsonAtomic } from "../paths";
import type { IcPlatformId } from "../types";

/**
 * 订阅源（Source Manager）持久化存储。
 * 自动抓取的调度依据：每个源 = 平台 + 查询 + 间隔 + 是否启用 + 是否自动打分。
 */

export interface IcSavedSource {
  id: string;
  platformId: IcPlatformId;
  name: string;
  query: Record<string, unknown>;
  enabled: boolean;
  intervalMinutes: number;
  autoScore: boolean; // 抓完是否自动便宜档打分（控成本，默认关）
  createdAt: string;
  lastRunAt?: string | null;
  lastCount?: number; // 上次新发现条数
  lastError?: string | null;
  nextPage?: number; // 翻页轮转：下次抓第几页（跑到底回卷到 1）
}

function file(): string {
  return path.join(icDataDir(), "sources.json");
}

function loadAll(): IcSavedSource[] {
  const f = file();
  if (!existsSync(f)) return [];
  try {
    const p = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(p) ? (p as IcSavedSource[]) : [];
  } catch {
    return [];
  }
}

function saveAll(rows: IcSavedSource[]): void {
  writeJsonAtomic(file(), rows);
}

export function listSavedSources(platformId?: IcPlatformId): IcSavedSource[] {
  const all = loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return platformId ? all.filter((s) => s.platformId === platformId) : all;
}

export function getSavedSource(id: string): IcSavedSource | undefined {
  return loadAll().find((s) => s.id === id);
}

export interface CreateSourceInput {
  platformId: IcPlatformId;
  name: string;
  query?: Record<string, unknown>;
  enabled?: boolean;
  intervalMinutes?: number;
  autoScore?: boolean;
}

export function createSavedSource(input: CreateSourceInput): IcSavedSource {
  const rec: IcSavedSource = {
    id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    platformId: input.platformId,
    name: input.name || `${input.platformId} 源`,
    query: input.query ?? {},
    enabled: input.enabled ?? true,
    intervalMinutes: Math.max(5, Math.round(input.intervalMinutes ?? 60)),
    autoScore: input.autoScore ?? false,
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    lastCount: 0,
    lastError: null,
    nextPage: 1,
  };
  saveAll([...loadAll(), rec]);
  return rec;
}

export function updateSavedSource(id: string, patch: Partial<IcSavedSource>): IcSavedSource | null {
  const all = loadAll();
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const next = { ...all[i], ...patch, id: all[i].id };
  if (patch.intervalMinutes != null) next.intervalMinutes = Math.max(5, Math.round(patch.intervalMinutes));
  if (patch.query != null) next.nextPage = 1; // 查询变了，翻页从头开始
  all[i] = next;
  saveAll(all);
  return next;
}

export function removeSavedSource(id: string): boolean {
  const all = loadAll();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  saveAll(next);
  return true;
}
