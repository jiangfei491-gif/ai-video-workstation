import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { EvolutionRun } from "./types";
import type {
  ModelPerformanceEntry,
  ScriptProviderId,
  ScriptStyleId,
  StylePerformanceEntry,
} from "./types";
import type { EvolutionUsageSummary } from "./evolution-usage";
import type { Material } from "../types";

const MODEL_FILE = "script-evolution-model-stats.json";
const STYLE_FILE = "script-evolution-style-stats.json";

type ModelStatsMap = Record<string, ModelPerformanceEntry>;
type StyleStatsMap = Record<string, StylePerformanceEntry>;

function loadModels(): ModelStatsMap {
  return readProductionJson<ModelStatsMap>(MODEL_FILE, {});
}

function loadStyles(): StyleStatsMap {
  return readProductionJson<StyleStatsMap>(STYLE_FILE, {});
}

function rollingAvg(prev: number, count: number, next: number): number {
  if (count <= 0) return next;
  return Math.round(((prev * count + next) / (count + 1)) * 10) / 10;
}

function rollingMs(prev: number, count: number, next: number): number {
  if (count <= 0) return next;
  return Math.round((prev * count + next) / (count + 1));
}

function categoryKey(category: string): string {
  return category.trim() || "未分类";
}

function ensureModel(key: string, provider: ScriptProviderId, modelVersion: string): ModelPerformanceEntry {
  return {
    provider,
    modelVersion,
    totalRuns: 0,
    outlineRuns: 0,
    outlineAvg: 0,
    fullRuns: 0,
    fullAvg: 0,
    championCount: 0,
    runnerUpCount: 0,
    top3Count: 0,
    winRate: 0,
    expandWinRate: 0,
    avgDurationMs: 0,
    avgTokens: 0,
    avgCostUsd: 0,
    judgeConsistency: 0,
    categoryAvgs: {},
    styleAvgs: {},
  };
}

function ensureStyle(style: ScriptStyleId): StylePerformanceEntry {
  return {
    style,
    useCount: 0,
    outlineAvg: 0,
    fullAvg: 0,
    championCount: 0,
    runnerUpCount: 0,
    winRate: 0,
    avgCompletionPredict: 0,
  };
}

function recomputeWinRate(entry: ModelPerformanceEntry): void {
  const podiums = entry.championCount + entry.runnerUpCount;
  entry.winRate =
    entry.fullRuns > 0 ? Math.round((podiums / entry.fullRuns) * 1000) / 10 : 0;
  entry.expandWinRate = entry.winRate;
}

function judgeStdDev(totals: number[]): number {
  if (totals.length < 2) return 0;
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance = totals.reduce((s, v) => s + (v - mean) ** 2, 0) / totals.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function recordEvolutionPerformance(
  run: EvolutionRun,
  material: Material,
  usage: EvolutionUsageSummary
): void {
  if (run.status !== "completed") return;

  const modelStats = loadModels();
  const styleStats = loadStyles();
  const cat = categoryKey(material.category);

  const providerTokens = new Map<ScriptProviderId, number[]>();
  const providerCosts = new Map<ScriptProviderId, number[]>();
  const providerMs = new Map<ScriptProviderId, number[]>();

  for (const call of usage.calls) {
    if (!providerTokens.has(call.provider)) providerTokens.set(call.provider, []);
    if (!providerCosts.has(call.provider)) providerCosts.set(call.provider, []);
    if (!providerMs.has(call.provider)) providerMs.set(call.provider, []);
    providerTokens.get(call.provider)!.push(call.inputTokens + call.outputTokens);
    providerCosts.get(call.provider)!.push(call.costUsd);
    providerMs.get(call.provider)!.push(call.durationMs);
  }

  for (const o of run.outlines) {
    const key = o.provider;
    const prev = modelStats[key] ?? ensureModel(key, o.provider, o.model);
    const score = o.totalScore ?? 0;
    prev.outlineAvg = rollingAvg(prev.outlineAvg, prev.outlineRuns, score);
    prev.outlineRuns += 1;
    prev.totalRuns += 1;
    prev.categoryAvgs[cat] = rollingAvg(prev.categoryAvgs[cat] ?? 0, prev.outlineRuns - 1, score);
    prev.styleAvgs[o.style] = rollingAvg(prev.styleAvgs[o.style] ?? 0, prev.outlineRuns - 1, score);
    modelStats[key] = prev;

    const sp = styleStats[o.style] ?? ensureStyle(o.style);
    sp.outlineAvg = rollingAvg(sp.outlineAvg, sp.useCount, score);
    sp.useCount += 1;
    styleStats[o.style] = sp;
  }

  for (const c of run.candidates) {
    const key = c.provider;
    const prev = modelStats[key] ?? ensureModel(key, c.provider, c.model);
    const score = c.aggregatedScore ?? c.totalScore ?? 0;
    prev.fullAvg = rollingAvg(prev.fullAvg, prev.fullRuns, score);
    prev.fullRuns += 1;
    prev.totalRuns += 1;
    if (c.id === run.championId) prev.championCount += 1;
    if (c.id === run.runnerUpId) prev.runnerUpCount += 1;
    if (run.championId === c.id || run.runnerUpId === c.id) prev.top3Count += 1;
    prev.categoryAvgs[cat] = rollingAvg(prev.categoryAvgs[cat] ?? 0, prev.fullRuns, score);
    prev.styleAvgs[c.style] = rollingAvg(prev.styleAvgs[c.style] ?? 0, prev.fullRuns, score);

    const judgeTotals = (c.judgeScores ?? []).map((j) => j.total);
    if (judgeTotals.length > 0) {
      prev.judgeConsistency = rollingAvg(
        prev.judgeConsistency,
        prev.fullRuns - 1,
        judgeStdDev(judgeTotals)
      );
    }

    const tokens = providerTokens.get(c.provider) ?? [];
    const costs = providerCosts.get(c.provider) ?? [];
    const ms = providerMs.get(c.provider) ?? [];
    if (tokens.length > 0) {
      prev.avgTokens = rollingMs(
        prev.avgTokens,
        prev.fullRuns - 1,
        Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)
      );
    }
    if (costs.length > 0) {
      prev.avgCostUsd =
        Math.round(
          rollingAvg(prev.avgCostUsd, prev.fullRuns - 1, costs.reduce((a, b) => a + b, 0)) * 1e4
        ) / 1e4;
    }
    if (ms.length > 0) {
      prev.avgDurationMs = rollingMs(
        prev.avgDurationMs,
        prev.fullRuns - 1,
        Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)
      );
    }

    recomputeWinRate(prev);
    modelStats[key] = prev;

    const sp = styleStats[c.style] ?? ensureStyle(c.style);
    sp.fullAvg = rollingAvg(sp.fullAvg, Math.max(1, sp.useCount), score);
    if (c.id === run.championId) sp.championCount += 1;
    if (c.id === run.runnerUpId) sp.runnerUpCount += 1;
    const completion = c.judgeScores?.[0]?.scores.completionRatePredict;
    if (completion != null) {
      sp.avgCompletionPredict = rollingAvg(sp.avgCompletionPredict, sp.useCount, completion);
    }
    const podiums = sp.championCount + sp.runnerUpCount;
    sp.winRate = sp.useCount > 0 ? Math.round((podiums / sp.useCount) * 1000) / 10 : 0;
    styleStats[c.style] = sp;
  }

  for (const entry of Object.values(modelStats)) {
    recomputeWinRate(entry);
  }

  for (const sp of Object.values(styleStats)) {
    let bestProvider: ScriptProviderId | undefined;
    let bestAvg = -1;
    for (const [p, entry] of Object.entries(modelStats)) {
      const avg = entry.styleAvgs[sp.style];
      if (avg != null && avg > bestAvg) {
        bestAvg = avg;
        bestProvider = p as ScriptProviderId;
      }
    }
    sp.bestProvider = bestProvider;
    let bestCat: string | undefined;
    let bestCatAvg = -1;
    for (const [c, avg] of Object.entries(
      Object.values(modelStats).reduce<Record<string, number>>((acc, m) => {
        for (const [k, v] of Object.entries(m.categoryAvgs)) {
          acc[k] = Math.max(acc[k] ?? 0, v);
        }
        return acc;
      }, {})
    )) {
      if (avg > bestCatAvg) {
        bestCatAvg = avg;
        bestCat = c;
      }
    }
    sp.bestCategory = bestCat;
  }

  writeProductionJson(MODEL_FILE, modelStats);
  writeProductionJson(STYLE_FILE, styleStats);
}

export function getModelPerformanceStats(): ModelPerformanceEntry[] {
  return Object.values(loadModels()).sort((a, b) => b.winRate - a.winRate);
}

export function getStylePerformanceStats(): StylePerformanceEntry[] {
  return Object.values(loadStyles()).sort((a, b) => b.winRate - a.winRate);
}
