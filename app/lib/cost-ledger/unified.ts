import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * 全平台统一成本总账。
 * 每一笔付费调用都记一行；一处价格表；可按 模块/模型/供应商/日期 汇总。
 * 内存缓存 + 异步防抖写盘，落在 ~/Desktop/AI-Veo/cost-ledger/entries.json。
 */

// ---- 价格表（一处维护，估算标 estimated） ----

/** 文本类：USD / 1M tokens */
export const TEXT_PRICING: Record<string, { in: number; out: number }> = {
  "deepseek-chat": { in: 0.27, out: 1.1 },
  deepseek: { in: 0.27, out: 1.1 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-sonnet": { in: 3, out: 15 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

/** 按次/单位计费的粗算单价（USD） */
export const UNIT_PRICING = {
  /** Veo 视频，按秒（约值，Veo 计费随档位变，仅估算） */
  "veo-per-sec": 0.35,
  /** 生图，按张 */
  "flux-schnell": 0.003,
  "flux-dev": 0.025,
  "gpt-image-1": 0.04,
  "gpt-image-2": 0.06,
  "imagen-3": 0.04,
  /** Gemini 视觉，按图（约 258 token） */
  "gemini-vision-per-image": 0.0005,
  /** ElevenLabs，按 1000 字符 */
  "elevenlabs-per-1k-chars": 0.3,
} as const;

function textKey(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("deepseek")) return "deepseek-chat";
  if (m.includes("gemini") && m.includes("pro")) return "gemini-2.5-pro";
  if (m.includes("gemini")) return "gemini-2.5-flash";
  if (m.includes("claude")) return "claude-sonnet-4-6";
  if (m.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (m.includes("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (m.includes("gpt-4.1")) return "gpt-4.1";
  if (m.includes("gpt-4o")) return "gpt-4o";
  return model;
}

export function estimateTokenCost(model: string, inTok: number, outTok: number): number {
  const p = TEXT_PRICING[textKey(model)] ?? TEXT_PRICING["gpt-4.1"];
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

/** 从模型名猜供应商（记账展示用） */
export function guessProvider(model: string): string {
  const m = (model || "").toLowerCase();
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("gemini") || m.includes("veo")) return "gemini";
  if (m.includes("claude")) return "anthropic";
  if (m.includes("gpt") || m.includes("openai") || m.includes("o1") || m.includes("o3")) return "openai";
  if (m.includes("eleven")) return "elevenlabs";
  if (m.includes("flux")) return "flux";
  return "other";
}

// ---- 总账存储 ----

export type CostModule =
  | "创作中心"
  | "AI导演"
  | "配音中心"
  | "字幕中心"
  | "音乐中心"
  | "特效中心"
  | "质检中心"
  | "内容中心"
  | "资源中心"
  | "情报中心"
  | "其他";

export interface CostEntry {
  id: string;
  at: string;
  module: CostModule;
  operation: string; // 脚本/分镜/生图/生视频/配音/视觉分析/打分…
  provider: string; // deepseek / gemini / veo / elevenlabs / flux / openai / anthropic
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number; // 张/秒/字符
  unitKind?: string;
  costUsd: number;
  estimated: boolean; // true=价格表估算，false=供应商真实用量
  projectId?: string;
  taskId?: string;
}

const CAP = 20000;

function file(): string {
  const root =
    process.env.AI_VIDEO_OS_ROOT?.trim() ||
    process.env.WORKSPACE_ROOT?.trim() ||
    path.join(homedir(), "AI-Veo");
  return path.join(root, "cost-ledger", "entries.json");
}

let cache: CostEntry[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadAll(): CostEntry[] {
  if (cache) return cache;
  const f = file();
  if (!existsSync(f)) return (cache = []);
  try {
    const p = JSON.parse(readFileSync(f, "utf8"));
    cache = Array.isArray(p) ? (p as CostEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function flush(): Promise<void> {
  if (!cache) return;
  const f = file();
  const data = JSON.stringify(cache.slice(-CAP), null, 0);
  try {
    mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, data, "utf8");
    await rename(tmp, f);
  } catch {
    /* 忽略 */
  }
}

/** 记一笔成本（best-effort，绝不抛错影响主流程） */
export function recordCost(entry: Omit<CostEntry, "id" | "at"> & { at?: string }): void {
  try {
    if (!(entry.costUsd >= 0)) return;
    const all = loadAll();
    all.push({
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: entry.at ?? new Date().toISOString(),
      ...entry,
    });
    cache = all.slice(-CAP);
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flush();
      }, 800);
    }
  } catch {
    /* 忽略记账错误 */
  }
}

/** 记文本模型调用（自动按价格表算钱） */
export function recordTokenCost(
  module: CostModule,
  operation: string,
  provider: string,
  model: string,
  inTok: number,
  outTok: number,
  opts?: { costUsd?: number; projectId?: string; taskId?: string },
): void {
  recordCost({
    module,
    operation,
    provider,
    model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: opts?.costUsd ?? estimateTokenCost(model, inTok, outTok),
    estimated: opts?.costUsd == null,
    projectId: opts?.projectId,
    taskId: opts?.taskId,
  });
}

/** 记按次/单位调用（生图/生视频/配音/视觉） */
export function recordUnitCost(
  module: CostModule,
  operation: string,
  provider: string,
  model: string,
  units: number,
  unitCostUsd: number,
  unitKind: string,
  opts?: { projectId?: string; taskId?: string },
): void {
  recordCost({
    module,
    operation,
    provider,
    model,
    units,
    unitKind,
    costUsd: units * unitCostUsd,
    estimated: true,
    projectId: opts?.projectId,
    taskId: opts?.taskId,
  });
}

// ---- 查询 / 汇总 ----

export interface CostFilter {
  since?: string; // ISO
  module?: string;
  limit?: number;
}

export function listCost(filter: CostFilter = {}): CostEntry[] {
  let all = loadAll().slice().sort((a, b) => b.at.localeCompare(a.at));
  if (filter.since) all = all.filter((e) => e.at >= filter.since!);
  if (filter.module) all = all.filter((e) => e.module === filter.module);
  return all.slice(0, filter.limit ?? 200);
}

export interface CostSummary {
  total: number;
  count: number;
  estimatedShare: number; // 估算部分占比
  byModule: { key: string; cost: number; count: number }[];
  byModel: { key: string; cost: number; count: number }[];
  byProvider: { key: string; cost: number; count: number }[];
  byDay: { key: string; cost: number }[];
  today: number;
  last30d: number;
}

export function summarizeCost(): CostSummary {
  const all = loadAll();
  const total = all.reduce((s, e) => s + e.costUsd, 0);
  const est = all.reduce((s, e) => s + (e.estimated ? e.costUsd : 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const group = (keyFn: (e: CostEntry) => string) => {
    const m = new Map<string, { cost: number; count: number }>();
    for (const e of all) {
      const k = keyFn(e) || "未知";
      const cur = m.get(k) ?? { cost: 0, count: 0 };
      cur.cost += e.costUsd;
      cur.count += 1;
      m.set(k, cur);
    }
    return [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.cost - a.cost);
  };
  const byDayMap = new Map<string, number>();
  for (const e of all) {
    const d = e.at.slice(0, 10);
    byDayMap.set(d, (byDayMap.get(d) ?? 0) + e.costUsd);
  }

  return {
    total,
    count: all.length,
    estimatedShare: total > 0 ? est / total : 0,
    byModule: group((e) => e.module),
    byModel: group((e) => e.model),
    byProvider: group((e) => e.provider),
    byDay: [...byDayMap.entries()].map(([key, cost]) => ({ key, cost })).sort((a, b) => a.key.localeCompare(b.key)).slice(-30),
    today: all.filter((e) => e.at.slice(0, 10) === today).reduce((s, e) => s + e.costUsd, 0),
    last30d: all.filter((e) => e.at >= d30).reduce((s, e) => s + e.costUsd, 0),
  };
}
