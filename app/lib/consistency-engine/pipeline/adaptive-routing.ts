/**
 * Adaptive Routing —— IMAGE(t2i) 生图 Tier 路由的纯决策核心。
 *
 * 两道门，职责分离：
 *   Tier1 QC  = Routing Gate（候选筛选器）：PASS / REPAIRABLE / FAIL → 决定后续动作
 *   Final QC  = Asset Admission Gate（资产准入门）：只有 PASS 才允许 Commit
 *
 * 这些函数是纯逻辑、无副作用、无 Provider 调用，供 runTieredShotPipeline 驱动，
 * 也供 regression fixture / cost simulation 直接验证（不需付费 Provider）。
 */

export type QcVerdict = "PASS" | "REPAIRABLE" | "FAIL";
export type TierCandidateAction = "REFINE" | "REGENERATE";
export type Tier1Route = "final" | "refine" | "regenerate";
export type FinalRoute = "commit" | "gptRepair" | "failed";

/** REPAIRABLE 判定带宽：composite 落在 [threshold-band, threshold) 视为可修，更低视为需重生 */
export const REPAIRABLE_BAND = 15;

/**
 * Tier1 QC 归一化 adapter：把 runScoreQC 的 {passed, composite} 归一为结构化 verdict。
 * 禁止在管线内散落 score 猜测——统一走此函数。
 */
export function normalizeGateVerdict(
  score: { passed: boolean; composite: number },
  threshold: number,
  band: number = REPAIRABLE_BAND
): QcVerdict {
  if (score.passed) return "PASS";
  if (score.composite >= threshold - band) return "REPAIRABLE";
  return "FAIL";
}

/** Tier1 verdict → 候选动作：PASS 直接进 Final QC；REPAIRABLE 精修；FAIL 重生成 */
export function routeAfterTier1(verdict: QcVerdict): Tier1Route {
  if (verdict === "PASS") return "final";
  if (verdict === "REPAIRABLE") return "refine";
  return "regenerate";
}

/** Final QC 准入决策：PASS→commit；FAIL 且未超次数→gptRepair；FAIL 且超次数→failed */
export function routeAfterFinal(
  finalPassed: boolean,
  repairAttempts: number,
  maxRepairAttempts: number
): FinalRoute {
  if (finalPassed) return "commit";
  if (repairAttempts < maxRepairAttempts) return "gptRepair";
  return "failed";
}

/**
 * REFINE / REGENERATE 的 prompt 语义区分（thin action adapter，不改 Provider）：
 * REFINE 携带原候选 + QC 反馈做定向修补；REGENERATE 明确从头重画。
 */
export function augmentDevPrompt(
  prompt: string,
  failedDimensions: string[],
  action: TierCandidateAction
): string {
  const issues = failedDimensions.length
    ? ` Issues to fix: ${failedDimensions.join(", ")}.`
    : "";
  const tag =
    action === "REFINE"
      ? "[REFINE the provided draft; preserve composition and identity, correct only the flagged issues.]"
      : "[REGENERATE from scratch; the previous attempt was rejected, produce a new composition.]";
  return `${prompt}\n\n${tag}${issues}`.trim();
}

// ───────────────────────── 纯路由模拟器（fixture / cost 用）─────────────────────────

export type RouteCounts = {
  tier1Candidate: number; // Tier1 候选生成（standard=schnell）
  tier1Qc: number; // Tier1 QC（Routing Gate）
  fluxDevRefine: number; // REPAIRABLE → FLUX Dev refine
  fluxDevRegenerate: number; // FAIL → FLUX Dev regenerate
  gptRepair: number; // Final QC FAIL → GPT Image 2 repair
  finalQc: number; // Final QC（Admission Gate）
};

export type RoutePlan = {
  committed: boolean;
  actions: string[];
  counts: RouteCounts;
};

/**
 * 纯模拟：给定 Tier1 verdict 与一串 Final QC 结果，走出与真实管线一致的动作序列与计数。
 * finalPassSeq[0] = 候选首次 Final QC；后续为每次 GPT repair 后的 Final QC。
 */
export function planImageTaskRoute(params: {
  tier1Verdict: QcVerdict;
  finalPassSeq: boolean[];
  maxRepairAttempts: number;
}): RoutePlan {
  const { tier1Verdict, finalPassSeq, maxRepairAttempts } = params;
  const counts: RouteCounts = {
    tier1Candidate: 1,
    tier1Qc: 1,
    fluxDevRefine: 0,
    fluxDevRegenerate: 0,
    gptRepair: 0,
    finalQc: 0,
  };
  const actions: string[] = ["TIER1", "TIER1_QC"];

  const route = routeAfterTier1(tier1Verdict);
  if (route === "refine") {
    counts.fluxDevRefine = 1;
    actions.push("REFINE");
  } else if (route === "regenerate") {
    counts.fluxDevRegenerate = 1;
    actions.push("REGENERATE");
  } // "final" → 直接进 Final QC，不精修

  let fi = 0;
  let attempts = 0;
  let passed = finalPassSeq[fi++] ?? false;
  counts.finalQc++;
  actions.push("FINAL_QC");

  for (;;) {
    if (passed) break;
    const decision = routeAfterFinal(passed, attempts, maxRepairAttempts);
    if (decision === "failed") break;
    // gptRepair
    attempts++;
    counts.gptRepair++;
    actions.push("GPT_REPAIR");
    passed = finalPassSeq[fi++] ?? false;
    counts.finalQc++;
    actions.push("FINAL_QC");
  }

  actions.push(passed ? "COMMIT" : "FAILED");
  return { committed: passed, actions, counts };
}
