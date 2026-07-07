import { randomUUID } from "crypto";
import {
  buildDurationPlan,
  clampDurationMinutes,
  type DurationPlan,
} from "./duration-config";
import { expandOutlineToScript } from "./expand-outline";
import { beginEvolutionUsage, finishEvolutionUsage } from "./evolution-usage";
import { generateOutlineCohort } from "./generate-outline-cohort";
import { pickTopTwoModelOutlines } from "./pick-top-models";
import { persistEvolutionData } from "./persist-evolution-data";
import { mapPool } from "./providers";
import { scoreFinalScriptWithAllJudges } from "./score-full-judge";
import { scoreOutlineCandidate } from "./score-outline-judge";
import { saveEvolutionRun } from "./store";
import type { EvolutionRun, OutlineCandidate, ScriptCandidate } from "./types";
import type { Material } from "../types";

export type EvolutionOptions = {
  durationMinutes?: number;
};

export type EvolutionProgressCallback = (run: EvolutionRun) => void;

async function mapOutlineScores(
  material: Material,
  plan: DurationPlan,
  outlines: OutlineCandidate[]
): Promise<OutlineCandidate[]> {
  return mapPool(outlines, 3, async (o) => {
    try {
      return await scoreOutlineCandidate(material, plan, o);
    } catch (err) {
      console.error("[script-evolution] 大纲评分失败", o.provider, o.style, err);
      return { ...o, totalScore: o.totalScore ?? 50 };
    }
  });
}

function rankFinalists(candidates: ScriptCandidate[]): ScriptCandidate[] {
  return [...candidates].sort(
    (a, b) => (b.aggregatedScore ?? b.totalScore ?? 0) - (a.aggregatedScore ?? a.totalScore ?? 0)
  );
}

export async function runScriptEvolution(
  material: Material,
  onProgress?: EvolutionProgressCallback,
  options?: EvolutionOptions
): Promise<EvolutionRun> {
  const plan = buildDurationPlan(options?.durationMinutes ?? 1);

  const run: EvolutionRun = {
    id: randomUUID(),
    materialId: material.id,
    materialTitle: material.title,
    startedAt: new Date().toISOString(),
    status: "running",
    stage: "启动 V2 脚本进化…",
    version: "v2",
    durationMinutes: plan.minutes,
    targetWordCount: plan.targetWordCount,
    chapterCount: plan.chapterCount,
    structureTemplate: plan.structureTemplate,
    outlines: [],
    candidates: [],
    rounds: [],
  };

  const tick = (patch: Partial<EvolutionRun>) => {
    Object.assign(run, patch);
    saveEvolutionRun(run);
    onProgress?.(run);
  };

  beginEvolutionUsage();

  try {
    tick({ stage: "阶段1：四模型随机风格生成大纲…" });
    const outlines = await generateOutlineCohort(material, plan, (done, total) => {
      tick({ stage: `大纲生成 ${done}/${total}…`, outlines: run.outlines });
    });
    tick({ outlines, stage: `已生成 ${outlines.length} 份大纲，开始评分…` });

    tick({ stage: "阶段2：大纲评分…" });
    const scoredOutlines = await mapOutlineScores(material, plan, outlines);
    tick({ outlines: scoredOutlines, stage: "大纲评分完成，选拔晋级模型…" });

    const picks = pickTopTwoModelOutlines(scoredOutlines);
    if (picks.length === 0) throw new Error("未能选拔出晋级模型");

    tick({
      stage: `阶段3：前 ${picks.length} 名模型扩写长文（约 ${plan.targetWordCount} 字）…`,
      rounds: [
        {
          round: 1,
          label: `大纲赛 → 晋级 ${picks.map((p) => p.provider).join("、")}`,
          survivorIds: picks.map((p) => p.outline.id),
          eliminatedIds: scoredOutlines
            .filter((o) => !picks.some((p) => p.outline.id === o.id))
            .map((o) => o.id),
        },
      ],
    });

    const expanded: ScriptCandidate[] = [];
    for (let i = 0; i < picks.length; i++) {
      tick({ stage: `扩写中 ${i + 1}/${picks.length}（${picks[i].provider}）…` });
      const script = await expandOutlineToScript(material, plan, picks[i]);
      expanded.push(script);
      tick({ candidates: [...expanded], stage: `已扩写 ${i + 1}/${picks.length}` });
    }

    tick({ stage: "阶段4：四模型全员长文评分…" });
    const judged: ScriptCandidate[] = [];
    for (let i = 0; i < expanded.length; i++) {
      tick({ stage: `长文评分 ${i + 1}/${expanded.length}…` });
      const scored = await scoreFinalScriptWithAllJudges(material, plan, expanded[i]);
      judged.push(scored);
      tick({ candidates: [...judged] });
    }

    const ranked = rankFinalists(judged);
    const champion = ranked[0];
    if (!champion) throw new Error("未产生冠军脚本");
    const runnerUp = ranked[1];

    Object.assign(run, {
      candidates: ranked,
      championId: champion.id,
      runnerUpId: runnerUp?.id,
      championScript: champion.script,
      runnerUpScript: runnerUp?.script,
    });

    const usage = finishEvolutionUsage();
    const { scriptRecordIds } = persistEvolutionData(run, material, usage);

    tick({
      candidates: ranked,
      championId: champion.id,
      runnerUpId: runnerUp?.id,
      championScript: champion.script,
      runnerUpScript: runnerUp?.script,
      topScriptIds: runnerUp ? [champion.id, runnerUp.id] : [champion.id],
      usage,
      scriptRecordIds,
      status: "completed",
      stage: "完成",
      completedAt: new Date().toISOString(),
      rounds: [
        ...run.rounds,
        {
          round: 2,
          label: "长文决赛",
          survivorIds: [champion.id],
          eliminatedIds: runnerUp ? [] : [],
        },
      ],
    });

    return run;
  } catch (err) {
    finishEvolutionUsage();
    tick({
      status: "failed",
      stage: "失败",
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    });
    throw err;
  }
}

export { clampDurationMinutes };
