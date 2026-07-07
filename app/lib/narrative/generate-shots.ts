import { emptyTokenLine, mergeTokenLine } from "@/app/lib/cost-ledger/merge";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import { shotIdFromIndex } from "@/app/lib/shared/shot-id";
import {
  deriveBeatProcess,
  decomposeVisualActionsRule,
  enrichBeatWithProcess,
} from "./decompose-visual-actions";
import { decomposeVisualActionsGpt } from "./decompose-visual-actions-gpt";
import { runShotDirectorQA, shotDirectorHardFailures } from "./shot-qa";
import { directShotsFromUnits } from "./shot-director";
import type { NarrativeBeat, NarrativeShot } from "./types";
import type { ShotDirectorQA, SourceIntent, VisualActionUnit } from "./visual-action-types";
import { computeBeatSplitDiagnostics } from "./validate-beat-split";

export type BeatShotPipelineResult = {
  beat: NarrativeBeat;
  units: VisualActionUnit[];
  sourceIntents: SourceIntent[];
  shots: Omit<NarrativeShot, "shotId" | "sceneNumber" | "duration">[];
  qa: ShotDirectorQA;
};

export async function generateShotsForBeat(params: {
  title: string;
  beat: NarrativeBeat;
  ruleOnly?: boolean;
}): Promise<{ result: BeatShotPipelineResult; usage: TokenCostLine }> {
  const process = deriveBeatProcess(params.beat);
  // GPT 拆镜是随机的：偶发 TEXT_COPY/MULTI_ACTION 等硬违规不应判死整轮编导。
  // 策略：GPT 重掷重试 → 取违规最少的一次；用尽仍不过则降级放行（记警告），不再抛。
  // 规则法是确定性的，重掷无意义，只跑 1 次。
  const maxAttempts = params.ruleOnly ? 1 : 3;
  let usage = emptyTokenLine();
  let best: { result: BeatShotPipelineResult; fails: string[] } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let units: VisualActionUnit[];
    let sourceIntents: SourceIntent[];
    if (params.ruleOnly) {
      const decomposed = decomposeVisualActionsRule(params.beat, process);
      units = decomposed.units;
      sourceIntents = decomposed.sourceIntents;
    } else {
      const gpt = await decomposeVisualActionsGpt({
        title: params.title,
        beat: params.beat,
        process,
      });
      units = gpt.units;
      sourceIntents = decomposedSourceIntentsFromUnits(units);
      usage = mergeTokenLine(usage, gpt.usage);
    }

    const enriched = enrichBeatWithProcess(params.beat, process, units);
    const shots = directShotsFromUnits(units, enriched);

    const qa = runShotDirectorQA({
      beats: [enriched],
      shots: shots.map((s, i) => ({
        ...s,
        shotId: `tmp_${i}`,
        sceneNumber: i + 1,
        duration: 6,
      })),
      units,
      sourceIntents,
    });
    const fails = shotDirectorHardFailures(qa);
    const result: BeatShotPipelineResult = { beat: enriched, units, sourceIntents, shots, qa };

    if (fails.length === 0) {
      return { result, usage };
    }
    if (!best || fails.length < best.fails.length) best = { result, fails };
    console.warn(
      `[shot-qa] beat ${params.beat.beatId} 拆镜 ${attempt}/${maxAttempts} 有 ${fails.length} 处硬违规：${fails.join("; ")}`
    );
  }

  // 重试用尽仍未通过：降级放行（best 必非空），不判死整轮；QA 结果随 result 返回，下游可见。
  console.warn(
    `[shot-qa] beat ${params.beat.beatId} 经 ${maxAttempts} 次仍未通过，降级放行：${best!.fails.join("; ")}`
  );
  return { result: best!.result, usage };
}

function decomposedSourceIntentsFromUnits(units: VisualActionUnit[]): SourceIntent[] {
  const seen = new Set<string>();
  const intents: SourceIntent[] = [];
  for (const u of units) {
    if (!u.sourceRef || seen.has(u.sourceRef)) continue;
    seen.add(u.sourceRef);
    intents.push({
      sourceRef: u.sourceRef,
      category: "concrete",
      intentCode: u.sourceIntent ?? "CONCRETE_ACTION",
      description: u.visibleAction,
    });
  }
  return intents;
}

export async function splitNarrativeShots(params: {
  title: string;
  beats: NarrativeBeat[];
  defaultDuration?: number;
  ruleOnly?: boolean;
}): Promise<{
  shots: NarrativeShot[];
  beats: NarrativeBeat[];
  units: VisualActionUnit[];
  sourceIntents: SourceIntent[];
  usage: TokenCostLine;
  shotQA: ShotDirectorQA;
  splitDiagnostics: ReturnType<typeof computeBeatSplitDiagnostics>;
}> {
  let usage = emptyTokenLine();
  const enrichedBeats: NarrativeBeat[] = [];
  const allUnits: VisualActionUnit[] = [];
  const allSourceIntents: SourceIntent[] = [];
  const rawAll: Omit<NarrativeShot, "shotId" | "sceneNumber" | "duration">[] = [];

  for (const beat of params.beats) {
    const { result, usage: partUsage } = await generateShotsForBeat({
      title: params.title,
      beat,
      ruleOnly: params.ruleOnly,
    });
    usage = mergeTokenLine(usage, partUsage);
    enrichedBeats.push(result.beat);
    allUnits.push(...result.units);
    allSourceIntents.push(...result.sourceIntents);
    rawAll.push(...result.shots);
  }

  const duration = params.defaultDuration ?? 6;
  const shots: NarrativeShot[] = rawAll.map((s, index) => ({
    ...s,
    shotId: shotIdFromIndex(index),
    sceneNumber: index + 1,
    duration,
  }));

  const shotQA = runShotDirectorQA({
    beats: enrichedBeats,
    shots,
    units: allUnits,
    sourceIntents: allSourceIntents,
  });
  const splitDiagnostics = computeBeatSplitDiagnostics(enrichedBeats, shots);

  return {
    shots,
    beats: enrichedBeats,
    units: allUnits,
    sourceIntents: allSourceIntents,
    usage,
    shotQA,
    splitDiagnostics,
  };
}

/** @deprecated 使用 generateShotsForBeat */
export function splitBeatRuleFallback(beat: NarrativeBeat) {
  const process = deriveBeatProcess(beat);
  const { units, sourceIntents } = decomposeVisualActionsRule(beat, process);
  const enriched = enrichBeatWithProcess(beat, process, units);
  const shots = directShotsFromUnits(units, enriched);
  return { beat: enriched, shots, units, sourceIntents };
}
