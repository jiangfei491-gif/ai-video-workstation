import type { EvolutionUsageSummary } from "./evolution-usage";
import { recordEvolutionPerformance } from "./record-performance";
import { appendScoreRecords, type ScoreRecordInput } from "./score-record-store";
import {
  createScriptRecordFromInput,
  type ScriptRecordInput,
} from "./script-record-store";
import type { EvolutionRun } from "./types";
import type { Material } from "../types";

function outlineScoreRecords(run: EvolutionRun, material: Material): ScoreRecordInput[] {
  const out: ScoreRecordInput[] = [];
  const ranked = [...run.outlines].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  for (const o of run.outlines) {
    if (!o.scores || !o.judgeProvider) continue;
    out.push({
      evolutionRunId: run.id,
      materialId: material.id,
      category: material.category,
      targetId: o.id,
      targetType: "outline",
      generatorProvider: o.provider,
      style: o.style,
      judgeProvider: o.judgeProvider,
      judgeModel: undefined,
      scores: o.scores,
      total: o.totalScore ?? o.scores.total,
      rank: ranked.findIndex((x) => x.id === o.id) + 1,
      brief: o.brief,
    });
  }
  return out;
}

function fullScriptScoreRecords(run: EvolutionRun, material: Material): ScoreRecordInput[] {
  const out: ScoreRecordInput[] = [];
  const ranked = [...run.candidates].sort(
    (a, b) => (b.aggregatedScore ?? 0) - (a.aggregatedScore ?? 0)
  );
  for (const c of run.candidates) {
    for (const j of c.judgeScores ?? []) {
      out.push({
        evolutionRunId: run.id,
        materialId: material.id,
        category: material.category,
        targetId: c.id,
        targetType: "full-script",
        generatorProvider: c.provider,
        style: c.style,
        judgeProvider: j.judgeProvider,
        scores: j.scores,
        total: j.total,
        rank: ranked.findIndex((x) => x.id === c.id) + 1,
        deductReasons: j.deductReasons,
        brief: j.brief,
      });
    }
  }
  return out;
}

function scriptRecordsFromRun(
  run: EvolutionRun,
  material: Material,
  usage: EvolutionUsageSummary
): ScriptRecordInput[] {
  const records: ScriptRecordInput[] = [];
  const costPerOutline =
    run.outlines.length > 0 ? usage.totalCostUsd / (run.outlines.length + run.candidates.length) : 0;

  for (const o of run.outlines) {
    records.push({
      evolutionRunId: run.id,
      materialId: material.id,
      materialTitle: material.title,
      category: material.category,
      role: "outline",
      provider: o.provider,
      style: o.style,
      model: o.model,
      durationMinutes: run.durationMinutes,
      targetWordCount: run.targetWordCount,
      outline: o.outline,
      outlineId: o.id,
      aggregatedScore: o.totalScore,
      costUsd: costPerOutline,
    });
  }

  const ranked = [...run.candidates].sort(
    (a, b) => (b.aggregatedScore ?? 0) - (a.aggregatedScore ?? 0)
  );
  for (let i = 0; i < ranked.length; i++) {
    const c = ranked[i];
    const role =
      c.id === run.championId ? "champion" : c.id === run.runnerUpId ? "runner-up" : "finalist";
    records.push({
      evolutionRunId: run.id,
      materialId: material.id,
      materialTitle: material.title,
      category: material.category,
      role,
      provider: c.provider,
      style: c.style,
      model: c.model,
      durationMinutes: run.durationMinutes,
      targetWordCount: run.targetWordCount,
      outline: c.outline,
      script: c.script,
      outlineId: c.outlineId,
      rank: i + 1,
      aggregatedScore: c.aggregatedScore ?? c.totalScore,
      costUsd: costPerOutline * 3,
    });
  }
  return records;
}

export function persistEvolutionData(
  run: EvolutionRun,
  material: Material,
  usage: EvolutionUsageSummary
): { scriptRecordIds: string[] } {
  appendScoreRecords([
    ...outlineScoreRecords(run, material),
    ...fullScriptScoreRecords(run, material),
  ]);

  const scriptInputs = scriptRecordsFromRun(run, material, usage);
  const scriptRecordIds: string[] = [];
  for (const input of scriptInputs) {
    const rec = createScriptRecordFromInput(input);
    scriptRecordIds.push(rec.id);
  }

  recordEvolutionPerformance(run, material, usage);
  return { scriptRecordIds };
}
