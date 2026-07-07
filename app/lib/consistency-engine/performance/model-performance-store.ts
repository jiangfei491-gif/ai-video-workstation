import { readProductionJson, writeProductionJson } from "@/app/lib/storage/production-json";
import type { QualityMode } from "@/app/lib/image/providers/types";

type ModelRun = {
  model: string;
  usedReferences: boolean;
  qcOverall: number;
  qcCharacter: number;
  qcStyle: number;
  durationMs: number;
  passed: boolean;
  costUsd?: number;
  qualityMode?: QualityMode;
  tier?: number;
  at: string;
};

export type ModelStats = {
  model: string;
  runs: number;
  passRate: number;
  avgQcOverall: number;
  avgQcCharacter: number;
  avgQcStyle: number;
  avgDurationMs: number;
  avgCostUsd: number;
  championScore: number;
};

const FILE = "consistency-model-performance.json";

function load(): ModelRun[] {
  return readProductionJson<ModelRun[]>(FILE, []);
}

function save(runs: ModelRun[]): void {
  writeProductionJson(FILE, runs.slice(-500));
}

/** Phase 9 — 记录每次生图模型表现 */
export function recordModelPerformance(run: Omit<ModelRun, "at">): void {
  const all = load();
  all.push({ ...run, at: new Date().toISOString() });
  save(all);
}

export function getModelPerformanceStats(): ModelStats[] {
  const runs = load();
  const byModel = new Map<string, ModelRun[]>();
  for (const r of runs) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model)!.push(r);
  }

  return [...byModel.entries()]
    .map(([model, list]) => {
      const n = list.length;
      const passRate = list.filter((x) => x.passed).length / n;
      const avg = (key: keyof ModelRun) =>
        list.reduce((s, x) => s + (Number(x[key]) || 0), 0) / n;
      const championScore = Math.round(
        (avg("qcOverall") * 0.35 +
          avg("qcCharacter") * 0.35 +
          avg("qcStyle") * 0.2 +
          passRate * 100 * 0.1) *
          10
      ) / 10;
      return {
        model,
        runs: n,
        passRate: Math.round(passRate * 100),
        avgQcOverall: Math.round(avg("qcOverall")),
        avgQcCharacter: Math.round(avg("qcCharacter")),
        avgQcStyle: Math.round(avg("qcStyle")),
        avgDurationMs: Math.round(avg("durationMs")),
        avgCostUsd: Math.round(avg("costUsd") * 10000) / 10000,
        championScore,
      };
    })
    .sort((a, b) => b.championScore - a.championScore);
}

export function recommendModel(purpose: "documentary" | "character" | "cinematic"): string {
  const stats = getModelPerformanceStats();
  if (stats.length === 0) return "flux-schnell";
  if (purpose === "character") {
    return [...stats].sort((a, b) => b.avgQcCharacter - a.avgQcCharacter)[0].model;
  }
  if (purpose === "cinematic") {
    return [...stats].sort((a, b) => b.avgQcStyle - a.avgQcStyle)[0].model;
  }
  return stats[0].model;
}

/** 性价比：高分且低成本优先 FLUX */
export function recommendTieredStrategy(): {
  draftModel: string;
  premiumModel: string;
} {
  const stats = getModelPerformanceStats();
  const flux = stats.find((s) => s.model.includes("flux"));
  const gpt = stats.find((s) => s.model.includes("gpt-image"));
  return {
    draftModel: flux?.model ?? "flux-schnell",
    premiumModel: gpt?.model ?? "gpt-image-2",
  };
}
