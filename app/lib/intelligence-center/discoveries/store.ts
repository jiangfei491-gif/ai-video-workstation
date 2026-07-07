import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { icDataDir } from "../paths";
import type { IcDiscoveredItem, IcPlatformId } from "../types";

/**
 * 自动抓取到的项目留档（让「抓取了啥」有真实的家）。
 * 按 item.id 去重：同一项目只存一次，后续可补打分。
 *
 * 性能：内存缓存 + 异步防抖写盘。避免每次调度都同步整读整写大 JSON 阻塞事件循环。
 */

export interface IcStoredDiscovery {
  item: IcDiscoveredItem;
  sourceId: string;
  firstSeenAt: string;
  score?: number;
  module?: string;
  worth?: boolean;
  reason?: string;
  scoredBy?: string;
  tags?: string[];
  advice?: string;
}

const CAP = 500;

function file(): string {
  return path.join(icDataDir(), "discoveries.json");
}

let cache: IcStoredDiscovery[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadAll(): IcStoredDiscovery[] {
  if (cache) return cache;
  const f = file();
  if (!existsSync(f)) return (cache = []);
  try {
    const p = JSON.parse(readFileSync(f, "utf8"));
    cache = Array.isArray(p) ? (p as IcStoredDiscovery[]).slice(0, CAP) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function flush(): Promise<void> {
  if (!cache) return;
  const f = file();
  const data = JSON.stringify(cache, null, 2);
  try {
    mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, data, "utf8");
    await rename(tmp, f);
  } catch {
    /* 写盘失败忽略：内存仍是最新，下次再写 */
  }
}

/** 更新内存 + 防抖异步写盘（不阻塞事件循环） */
function saveAll(rows: IcStoredDiscovery[]): void {
  cache = rows.slice(0, CAP);
  if (flushTimer) return; // 已排程，合并多次写入为一次
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 800);
}

/** 追加新发现（去重）；返回本次真正新增的项 */
export function addDiscoveries(sourceId: string, items: IcDiscoveredItem[]): IcStoredDiscovery[] {
  const all = loadAll();
  const seen = new Set(all.map((d) => d.item.id));
  const now = new Date().toISOString();
  const added = items
    .filter((it) => it?.id && !seen.has(it.id))
    .map((it) => ({ item: it, sourceId, firstSeenAt: now }));
  if (added.length) saveAll([...added, ...all]);
  return added;
}

export function listDiscoveries(platformId?: IcPlatformId, limit = 100): IcStoredDiscovery[] {
  let all = loadAll().sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  if (platformId) all = all.filter((d) => d.item.platformId === platformId);
  return all.slice(0, limit);
}

/** 把打分结果补写到对应发现项上 */
export function attachScores(
  scored: { item: { id: string }; score: number; module: string; worth: boolean; reason: string; scoredBy: string; tags?: string[]; advice?: string }[],
): void {
  const all = loadAll();
  const byId = new Map(all.map((d, i) => [d.item.id, i] as const));
  for (const s of scored) {
    const i = byId.get(s.item.id);
    if (i == null) continue;
    all[i] = { ...all[i], score: s.score, module: s.module, worth: s.worth, reason: s.reason, scoredBy: s.scoredBy, tags: s.tags ?? all[i].tags, advice: s.advice ?? all[i].advice };
  }
  saveAll(all);
}
