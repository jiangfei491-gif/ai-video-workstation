import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * 「判定台账」——记住每条资源的判定结果（不存文件，只存结论）。
 * 抓取在发现阶段先查：已入库/已拒绝的直接跳过，不重复下载、不重复分析。
 * 键 = sourceId + remoteUrl（抓取和分析两端都拿得到）。
 *
 * 内存缓存 + 异步防抖写盘（不阻塞事件循环）。
 */

export type IcVerdict = "ingested" | "rejected";

interface LedgerEntry {
  verdict: IcVerdict;
  reason?: string;
  at: string;
}

const CAP = 50000;

function file(): string {
  const root =
    process.env.AI_VIDEO_OS_ROOT?.trim() ||
    process.env.WORKSPACE_ROOT?.trim() ||
    path.join(homedir(), "AI-Veo");
  return path.join(root, "resource-center", "judged-ledger.json");
}

function key(sourceId: string, remoteUrl: string): string {
  return `${sourceId}::${remoteUrl}`;
}

let cache: Record<string, LedgerEntry> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Record<string, LedgerEntry> {
  if (cache) return cache;
  const f = file();
  if (!existsSync(f)) return (cache = {});
  try {
    const parsed = JSON.parse(readFileSync(f, "utf8"));
    cache = parsed && typeof parsed === "object" ? (parsed as Record<string, LedgerEntry>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function flush(): Promise<void> {
  if (!cache) return;
  const f = file();
  // 超上限时丢最早的
  let entries = Object.entries(cache);
  if (entries.length > CAP) {
    entries = entries.sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, CAP);
    cache = Object.fromEntries(entries);
  }
  const data = JSON.stringify(cache, null, 0);
  try {
    mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, data, "utf8");
    await rename(tmp, f);
  } catch {
    /* 写盘失败忽略：内存仍最新 */
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 1000);
}

/** 该条是否已判定过（已入库或已拒绝）→ 抓取跳过 */
export function isJudged(sourceId: string, remoteUrl: string): boolean {
  return Boolean(load()[key(sourceId, remoteUrl)]);
}

/** 记一条判定 */
export function recordVerdict(sourceId: string, remoteUrl: string, verdict: IcVerdict, reason?: string): void {
  if (!sourceId || !remoteUrl) return;
  const all = load();
  all[key(sourceId, remoteUrl)] = { verdict, reason, at: new Date().toISOString() };
  cache = all;
  scheduleFlush();
}
