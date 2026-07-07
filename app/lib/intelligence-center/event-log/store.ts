import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { icDataDir } from "../paths";
import { activityIcEvent } from "@/app/lib/workbench-activity/bridges/intelligence-center";
import type { IcPlatformId } from "../types";

/**
 * 情报中心统一事件日志（持久化 JSON，喂 History + Logs 两个子模块）。
 * discover / score / approve / reject / install 各处 emit 一条。
 */

export type IcEventKind = "discover" | "score" | "enqueue" | "approve" | "reject" | "install";
export type IcEventLevel = "info" | "warn" | "error";

export interface IcEvent {
  id: string;
  at: string;
  platformId?: IcPlatformId;
  kind: IcEventKind;
  level: IcEventLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const MAX_EVENTS = 1000;

function file(): string {
  return path.join(icDataDir(), "events.json");
}

// 内存缓存 + 异步防抖写盘，避免高频 logEvent 同步写盘阻塞事件循环
let cache: IcEvent[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadAll(): IcEvent[] {
  if (cache) return cache;
  const f = file();
  if (!existsSync(f)) return (cache = []);
  try {
    const parsed = JSON.parse(readFileSync(f, "utf8"));
    cache = Array.isArray(parsed) ? (parsed as IcEvent[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function flush(): Promise<void> {
  if (!cache) return;
  const f = file();
  const data = JSON.stringify(cache.slice(-MAX_EVENTS), null, 2);
  try {
    mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, data, "utf8");
    await rename(tmp, f);
  } catch {
    /* 忽略 */
  }
}

function saveAll(events: IcEvent[]): void {
  cache = events.slice(-MAX_EVENTS);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 800);
}

/** 追加一条事件（best-effort，出错不抛，避免影响主流程） */
export function logEvent(e: Omit<IcEvent, "id" | "at"> & { at?: string }): void {
  try {
    const all = loadAll();
    all.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: e.at ?? new Date().toISOString(),
      platformId: e.platformId,
      kind: e.kind,
      level: e.level,
      message: e.message,
      meta: e.meta,
    });
    saveAll(all);
    // 汇入全站唯一日志窗口「工作台动态」
    activityIcEvent(e.kind, e.level, e.message, typeof e.meta?.error === "string" ? e.meta.error : undefined);
  } catch {
    /* 忽略日志写入错误 */
  }
}

export interface IcEventFilter {
  platformId?: IcPlatformId;
  kind?: IcEventKind;
  level?: IcEventLevel;
  limit?: number;
}

export function listEvents(filter: IcEventFilter = {}): IcEvent[] {
  let all = loadAll().sort((a, b) => b.at.localeCompare(a.at));
  if (filter.platformId) all = all.filter((e) => e.platformId === filter.platformId);
  if (filter.kind) all = all.filter((e) => e.kind === filter.kind);
  if (filter.level) all = all.filter((e) => e.level === filter.level);
  return all.slice(0, filter.limit ?? 200);
}
