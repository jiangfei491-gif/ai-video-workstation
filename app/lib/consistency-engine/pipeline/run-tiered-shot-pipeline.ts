import fs from "fs";
import { saveImageAsset } from "@/app/lib/asset-library";
import { tempFilePath } from "@/app/lib/storage/workspace-paths";
import { composeFinalPrompt } from "../composer/prompt-composer";
import { collectReferencePaths } from "../reference/collect-refs";
import { runVisualQC } from "../qc/visual-qc";
import { buildRepairPrompt } from "../repair/auto-repair";
import { runScoreQC, pickBestScored } from "../qc/score-qc";
import { recordModelPerformance } from "../performance/model-performance-store";
import type { ComposeInput } from "../types/compose";
import type { ConsistencySettings, ShotTimelineEntry } from "../types/world-style-camera";
import type { QCVerdict } from "../types/qc";
import type { ScoreQCResult } from "../qc/score-qc";
import type { ImageSizeKey } from "@/app/lib/image/providers/types";
import {
  resolveOutputDimensions,
  type AspectClarityFields,
} from "@/app/lib/generation-params";
import {
  generateTier1Draft,
  generateTier3Premium,
  generateFluxDevRefine,
} from "@/app/lib/image/providers/router";
import {
  SCORE_QC_COST_USD,
  FINAL_QC_COST_USD,
} from "@/app/lib/image/providers/pricing";
import {
  normalizeGateVerdict,
  routeAfterTier1,
  routeAfterFinal,
  augmentDevPrompt,
  type QcVerdict,
} from "./adaptive-routing";
import { addCallCost, addCallUsage, emptyCallLine } from "@/app/lib/cost-ledger/merge";
import type { ApiUsage, ShotPipelineCostDetail } from "@/app/lib/cost-ledger/types";
import type { GenerateImageOutput } from "@/app/lib/image/providers/types";

import type { ImageTaskQCContext } from "@/app/lib/image-task/qc-context";

export type TieredPipelineInput = ComposeInput & {
  rawDeltaPrompt: string;
  purpose: "final" | "first-frame";
  count: number;
  settings: ConsistencySettings;
  clarity?: AspectClarityFields["clarity"];
  customAspectRatio?: string;
  customClarityWidth?: number;
  customClarityHeight?: number;
  imageTaskContext?: ImageTaskQCContext;
};

export type TieredPipelineFrame = {
  url: string;
  assetId: string;
  model: string;
  source: string;
  usedReferences: boolean;
  tier: number;
  score?: ScoreQCResult;
};

export type TieredPipelineResult = {
  frames: TieredPipelineFrame[];
  composed: ReturnType<typeof composeFinalPrompt>;
  finalPrompt: string;
  qc?: QCVerdict;
  score?: ScoreQCResult;
  timeline: ShotTimelineEntry;
  repairAttempts: number;
  totalCostUsd: number;
  qualityMode: ConsistencySettings["qualityMode"];
  upgradedToPremium: boolean;
  costDetail: ShotPipelineCostDetail;
  /** Final QC 准入门未通过 → TASK_FAILED（frames 为空，禁止提交资产） */
  failed?: boolean;
  failureReason?: string;
  /** 命中的 Tier1 路由 verdict（审计用） */
  routeVerdict?: QcVerdict;
};

function resolvePipelineDimensions(input: TieredPipelineInput): {
  size: ImageSizeKey;
  dimensions: { width: number; height: number };
} {
  const resolved = resolveOutputDimensions({
    aspectRatio: input.aspectRatio,
    customAspectRatio: input.customAspectRatio,
    clarity: input.clarity ?? "1080p",
    customClarityWidth: input.customClarityWidth,
    customClarityHeight: input.customClarityHeight,
  });
  return {
    size: resolved.openAiSize,
    dimensions: { width: resolved.width, height: resolved.height },
  };
}

function saveFrame(
  buffer: Buffer,
  prompt: string,
  model: string,
  source: string,
  width: number,
  height: number
): { url: string; assetId: string } {
  const asset = saveImageAsset({
    prompt,
    buffer,
    model,
    source: source as "gpt-image-2" | "gpt-image-1",
    width,
    height,
  });
  return { url: asset.publicUrl, assetId: asset.id };
}

function suffix(purpose: string): string {
  return purpose === "first-frame"
    ? "Cinematic film still, highly detailed, consistent character design, natural lighting."
    : "High quality still image, complete composition, highly detailed, photorealistic documentary style.";
}

function writeTempDraft(buffer: Buffer): string {
  const p = tempFilePath(`flux-draft-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(p, buffer);
  return p;
}

function accumulateVisionUsage(line: ReturnType<typeof emptyCallLine>, usage?: ApiUsage) {
  if (!usage) return { line, costUsd: 0 };
  return {
    line: addCallUsage(line, usage, 1),
    costUsd: usage.costUsd,
  };
}

function accumulateGptImage(line: ReturnType<typeof emptyCallLine>, items: GenerateImageOutput[]) {
  let next = line;
  let costUsd = 0;
  for (const item of items) {
    next = addCallCost(next, item.estimatedCostUsd, 1, {
      model: item.model,
      inputTokens: item.inputTokens ?? 0,
      outputTokens: item.outputTokens ?? 0,
    });
    costUsd += item.estimatedCostUsd;
  }
  return { line: next, costUsd };
}

/**
 * 四级生图策略：
 * T1 FLUX 草稿 → T2 AI 评分 → T3 GPT Image 精修 → T4 Final QC + Repair
 */
export async function runTieredShotPipeline(
  input: TieredPipelineInput
): Promise<TieredPipelineResult> {
  const composed = composeFinalPrompt(input);
  const prompt = `${composed.finalPrompt}\n\n${suffix(input.purpose)}`;
  const refs = collectReferencePaths({
    characterIds: input.characterIds,
    sceneId: input.sceneId,
    propIds: input.propIds,
  });
  const refBuffers = refs.paths.map((p) => fs.readFileSync(p));
  const { size, dimensions } = resolvePipelineDimensions(input);
  const count = Math.max(1, Math.min(4, input.count));
  const mode = input.settings.qualityMode ?? "standard";
  const threshold = input.settings.scoreThreshold ?? 90;
  const multiDraft = count > 1;

  let totalCostUsd = 0;
  let fluxDetail = emptyCallLine();
  let visionQcDetail = emptyCallLine();
  let gptImageDetail = emptyCallLine();
  const started = Date.now();

  // —— Tier 1: FLUX 批量草稿 ——
  const tier1 = await generateTier1Draft(
    { prompt, refPaths: refs.paths, size, dimensions, count },
    mode === "flagship"
  );
  totalCostUsd += tier1.reduce((s, i) => s + i.estimatedCostUsd, 0);
  const tier1Cost = tier1.reduce((s, i) => s + i.estimatedCostUsd, 0);
  fluxDetail = addCallCost(fluxDetail, tier1Cost, tier1.length);

  // —— Tier 2: AI 评分 ——
  const scored = await Promise.all(
    tier1.map(async (img) => {
      const score = await runScoreQC({
        imageBuffer: img.buffer,
        composedPrompt: composed.finalPrompt,
        referenceBuffers: refBuffers,
        threshold,
        draftRound: true,
        imageTaskContext: input.imageTaskContext,
      });
      const tracked = accumulateVisionUsage(visionQcDetail, score.usage);
      visionQcDetail = tracked.line;
      totalCostUsd += tracked.costUsd > 0 ? tracked.costUsd : SCORE_QC_COST_USD;
      if (tracked.costUsd === 0) {
        visionQcDetail = addCallCost(visionQcDetail, SCORE_QC_COST_USD, 1);
      }
      return { img, score };
    })
  );

  // 多候选首帧：只评分，不自动精修，供用户选用
  if (multiDraft) {
    const frames: TieredPipelineFrame[] = scored.map(({ img, score }) => {
      const s = saveFrame(
        img.buffer,
        prompt,
        img.model,
        img.source,
        dimensions.width,
        dimensions.height
      );
      return {
        url: s.url,
        assetId: s.assetId,
        model: img.model,
        source: img.source,
        usedReferences: img.usedReferences,
        tier: 1,
        score,
      };
    });
    const best = pickBestScored(scored)!;
    recordModelPerformance({
      model: best.img.model,
      usedReferences: false,
      qcOverall: best.score.scores.composite,
      qcCharacter: best.score.scores.character,
      qcStyle: best.score.scores.style,
      durationMs: Date.now() - started,
      passed: best.score.passed,
      costUsd: totalCostUsd,
      qualityMode: mode,
      tier: 1,
    });
    const bestIdx = scored.indexOf(best);
    const primary = frames[bestIdx >= 0 ? bestIdx : 0];
    const timeline: ShotTimelineEntry = {
      shotIndex: input.shotIndex,
      composedPrompt: composed.finalPrompt,
      finalPrompt: prompt,
      frameUrl: primary.url,
      assetId: primary.assetId,
      model: primary.model,
      referencePaths: refs.paths,
      score: best.score,
      repairAttempts: 0,
      deltaChanges: [`${count} 张 FLUX 草稿`, `质量模式: ${mode}`],
      qualityMode: mode,
      upgradedToPremium: false,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      draftModel: tier1[0]?.model,
      createdAt: new Date().toISOString(),
    };
    return {
      frames,
      composed,
      finalPrompt: prompt,
      score: best.score,
      timeline,
      repairAttempts: 0,
      totalCostUsd,
      qualityMode: mode,
      upgradedToPremium: false,
      costDetail: {
        flux: fluxDetail,
        visionQc: visionQcDetail,
        gptImage: emptyCallLine(),
      },
    };
  }

  // ============================================================
  //  单候选 · Adaptive Routing
  //  Tier1 QC = Routing Gate（分流）；Final QC = Asset Admission Gate（准入）。
  //  候选(Tier1)模型已在上游 generateTier1Draft 按 mode 决定（standard=schnell），此处不改。
  //  取代原「固定流水线」：不再无条件 FLUX Dev 精修，不再让 QC FAIL 图落地为资产。
  // ============================================================
  const best = pickBestScored(scored)!;
  const tier1Score = best.score;
  let candidate: GenerateImageOutput = best.img;
  let candidateTier = 1;
  let refineLabel = "FLUX 草稿";

  const gateVerdict: QcVerdict = normalizeGateVerdict(
    { passed: tier1Score.passed, composite: tier1Score.scores.composite },
    threshold
  );
  const tier1Route = routeAfterTier1(gateVerdict);

  // REPAIRABLE → FLUX Dev refine（携带原候选 + QC 反馈）；FAIL → FLUX Dev regenerate（不带草稿，重画）
  if (tier1Route === "refine" || tier1Route === "regenerate") {
    const action = tier1Route === "refine" ? "REFINE" : "REGENERATE";
    const draftPath = writeTempDraft(candidate.buffer);
    try {
      const devPrompt = augmentDevPrompt(prompt, tier1Score.failedDimensions, action);
      const refPathsForAction =
        action === "REFINE" ? [...refs.paths, draftPath] : refs.paths;
      const out = await generateFluxDevRefine({
        prompt: devPrompt,
        refPaths: refPathsForAction,
        size,
        dimensions,
        count: 1,
      });
      const cost = out.reduce((s, i) => s + i.estimatedCostUsd, 0);
      fluxDetail = addCallCost(fluxDetail, cost, out.length, {
        model: out[0]?.model ?? "flux-dev",
        inputTokens: 0,
        outputTokens: 0,
      });
      totalCostUsd += cost;
      if (out[0]) candidate = out[0];
      candidateTier = 3;
      refineLabel = action === "REFINE" ? "FLUX Dev 精修" : "FLUX Dev 重生成";
    } finally {
      try {
        fs.unlinkSync(draftPath);
      } catch {
        /* ignore */
      }
    }
  }

  // ===== Final QC = Asset Admission Gate（所有路径统一进入）=====
  let finalQc: QCVerdict | undefined;
  let repairAttempts = 0;
  let committed: boolean;

  const runFinalQc = async (): Promise<QCVerdict> => {
    const v = await runVisualQC({
      imageBuffer: candidate.buffer,
      referenceBuffers: refBuffers,
      composedPrompt: composed.finalPrompt,
      imageTaskContext: input.imageTaskContext,
    });
    const tracked = accumulateVisionUsage(visionQcDetail, v.usage);
    visionQcDetail = tracked.line;
    totalCostUsd += tracked.costUsd > 0 ? tracked.costUsd : FINAL_QC_COST_USD;
    if (tracked.costUsd === 0) {
      visionQcDetail = addCallCost(visionQcDetail, FINAL_QC_COST_USD, 1);
    }
    return v;
  };

  if (input.settings.qcEnabled) {
    finalQc = await runFinalQc();
    // Final QC FAIL → GPT Image 2 repair（携带当前 frame + Final QC 反馈），受 maxRepairAttempts 控制
    while (
      routeAfterFinal(finalQc.passed, repairAttempts, input.settings.maxRepairAttempts) ===
      "gptRepair"
    ) {
      repairAttempts++;
      const framePath = writeTempDraft(candidate.buffer);
      try {
        const repairPrompt = buildRepairPrompt(prompt, finalQc);
        const repaired = await generateTier3Premium({
          prompt: repairPrompt,
          refPaths: refs.paths.length > 0 ? refs.paths : [framePath],
          size,
          count: 1,
        });
        const tracked = accumulateGptImage(gptImageDetail, repaired);
        gptImageDetail = tracked.line;
        totalCostUsd += tracked.costUsd;
        if (repaired[0]) candidate = repaired[0];
        candidateTier = 3;
        refineLabel = "GPT Image 修复";
      } finally {
        try {
          fs.unlinkSync(framePath);
        } catch {
          /* ignore */
        }
      }
      finalQc = await runFinalQc();
    }
    committed = finalQc.passed;
  } else {
    // QC 关闭：无准入门，候选直接提交（用户显式关闭 QC）
    committed = true;
  }

  const costDetail: ShotPipelineCostDetail = {
    flux: fluxDetail,
    visionQc: visionQcDetail,
    gptImage: gptImageDetail,
  };
  recordModelPerformance({
    model: candidate.model,
    usedReferences: candidate.usedReferences,
    qcOverall: finalQc?.scores.overall ?? tier1Score.scores.composite,
    qcCharacter: finalQc?.scores.character ?? tier1Score.scores.character,
    qcStyle: finalQc?.scores.style ?? tier1Score.scores.style,
    durationMs: Date.now() - started,
    passed: committed,
    costUsd: totalCostUsd,
    qualityMode: mode,
    tier: candidateTier,
  });

  const deltaChanges = [
    input.shotDelta.action && `动作: ${input.shotDelta.action}`,
    input.shotDelta.camera && `镜头: ${input.shotDelta.camera}`,
    input.shotDelta.lighting && `光线: ${input.shotDelta.lighting}`,
    refineLabel,
    `质量模式: ${mode}`,
    `路由: ${gateVerdict}`,
  ].filter(Boolean) as string[];

  // ===== 准入未通过 → TASK_FAILED：禁止 saveFrame / 禁止返回 frame =====
  if (!committed) {
    const failTimeline: ShotTimelineEntry = {
      shotIndex: input.shotIndex,
      composedPrompt: composed.finalPrompt,
      finalPrompt: prompt,
      frameUrl: "",
      assetId: "",
      model: candidate.model,
      referencePaths: refs.paths,
      qc: finalQc,
      score: tier1Score,
      repairAttempts,
      deltaChanges,
      qualityMode: mode,
      upgradedToPremium: candidateTier === 3,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      draftModel: tier1[0]?.model,
      createdAt: new Date().toISOString(),
    };
    return {
      frames: [],
      failed: true,
      failureReason: `Final QC 未通过（GPT repair ${repairAttempts}/${input.settings.maxRepairAttempts} 次仍未达标）`,
      routeVerdict: gateVerdict,
      composed,
      finalPrompt: prompt,
      qc: finalQc,
      score: tier1Score,
      timeline: failTimeline,
      repairAttempts,
      totalCostUsd,
      qualityMode: mode,
      upgradedToPremium: candidateTier === 3,
      costDetail,
    };
  }

  // ===== Asset Commit（仅 Final QC PASS）=====
  const saved = saveFrame(
    candidate.buffer,
    prompt,
    candidate.model,
    candidate.source,
    dimensions.width,
    dimensions.height
  );
  const frame: TieredPipelineFrame = {
    url: saved.url,
    assetId: saved.assetId,
    model: candidate.model,
    source: candidate.source,
    usedReferences: candidate.usedReferences,
    tier: candidateTier,
    score: tier1Score,
  };
  const timeline: ShotTimelineEntry = {
    shotIndex: input.shotIndex,
    composedPrompt: composed.finalPrompt,
    finalPrompt: prompt,
    frameUrl: saved.url,
    assetId: saved.assetId,
    model: candidate.model,
    referencePaths: refs.paths,
    qc: finalQc,
    score: tier1Score,
    repairAttempts,
    deltaChanges,
    qualityMode: mode,
    upgradedToPremium: candidateTier === 3,
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    draftModel: tier1[0]?.model,
    createdAt: new Date().toISOString(),
  };
  return {
    frames: [frame],
    routeVerdict: gateVerdict,
    composed,
    finalPrompt: prompt,
    qc: finalQc,
    score: tier1Score,
    timeline,
    repairAttempts,
    totalCostUsd,
    qualityMode: mode,
    upgradedToPremium: candidateTier === 3,
    costDetail,
  };
}
