/**
 * Narrative Duration Planner (Phase 1) —— IMAGE(t2i) 时间预算链。
 *
 * 修复「shotCount × 固定镜长 = 视频时长」的错误时间模型，改为：
 *   targetDuration → Beat 预算(estimatedNarrationWeight) → Beat 内 Shot 分配(shotPurpose) → 每镜时长
 *
 * 纯函数：不读 workbench、不调 Provider、不调 TTS、不改输入对象。
 * 身份键：Beat 按 beatId、Shot 按 shotId 定位（禁止 shotIndex 作主身份）。
 */

import { estimateNarrationDurationSec } from "./estimate-narration-duration";

/** 单镜安全下界（秒）——过短的静态图切换生硬 */
export const MIN_SHOT_DURATION_SEC = 2;
/** 单镜安全上界（秒）——过长的静态图枯燥 */
export const MAX_SHOT_DURATION_SEC = 12;
/** 无旁白镜头的最小视觉存在时间（秒/镜）——保证空旁白 Beat 不被分到 0 时长 */
export const RESIDUAL_VISUAL_SEC_PER_SHOT = 1.5;
/** 旁白 planning floor 余量（秒）——planned ≥ 估时+pad，收敛真实 voice 的 Math.max drift */
export const NARRATION_PLANNING_PAD_SEC = 0.25;
/** shotPurpose 视觉残余的秒当量（Beat 内无旁白/次要权重） */
export const SHOT_VISUAL_RESIDUAL_SEC = 1.0;

export type DurationPlanBeat = {
  beatId: string;
  /** Beat 级旁白文本（Phase 2：作为时长预算主依据） */
  narration?: string;
  /** GPT 主观叙事权重（Phase 2 起仅作 residual 次级调节，不再是旁白时长主代理） */
  estimatedNarrationWeight?: number;
};

export type DurationPlanShot = {
  shotId?: string;
  beatId?: string;
  shotPurpose?: string;
  /** 该镜旁白文本（来自 NarrationAssignment，写回 storyboard.narration）——shot 级时长主依据 */
  narration?: string;
  action?: string;
  reaction?: string;
};

export type DurationPlanResult = {
  /** beatId → 分配时长(秒) */
  beatDurations: Record<string, number>;
  /** shotId → 分配时长(秒) */
  shotDurations: Record<string, number>;
  /** shotId → 旁白 planning floor(秒)——planned 的下界（估时+pad），非真实 voice */
  narrationFloors: Record<string, number>;
  totalDurationSec: number;
  /** 约束/降级告警（不静默漂移） */
  warnings: string[];
};

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * shotPurpose → Beat 内 Shot 权重（deterministic keyword adapter，容错 normalize/includes）。
 * 只影响 Beat 内相对分配，不参与 Beat 级预算。
 */
export function shotPurposeWeight(shotPurpose?: string): number {
  const p = (shotPurpose ?? "").toLowerCase().trim();
  if (!p) return 1; // 未知/缺失 → fallback 1
  const has = (ks: string[]) => ks.some((k) => p.includes(k));
  if (has(["定场", "establish", "setup"])) return 1.4; // 定场较长
  if (has(["揭示", "信息", "reveal", "exposition", "information"])) return 1.2; // 信息中偏长
  if (has(["反应", "情绪", "reaction", "emotional"])) return 1.2; // 反应中偏长
  if (has(["转场", "过渡", "transition", "bridge"])) return 0.6; // 转场较短
  if (has(["细节", "呈现", "detail", "insert"])) return 0.6; // 细节较短
  if (has(["动作", "推进", "action", "progression"])) return 1.0; // 动作中等
  return 1; // 无法识别 → fallback 1
}

/**
 * Beat 时长预算权重（Phase 2）：主依据 = 旁白估时（秒）；空旁白 Beat 保留视觉残余，避免 0 时长。
 * estimatedNarrationWeight 仅作 residual 的 ±25% 次级调节（不再是旁白时长主代理）。
 */
export function beatTimingWeight(
  narration: string | undefined,
  shotCount: number,
  estimatedNarrationWeight?: number
): number {
  const narrationEst = estimateNarrationDurationSec(narration ?? "").durationSec;
  const importance = Math.min(
    1,
    Math.max(0, Number.isFinite(estimatedNarrationWeight) ? (estimatedNarrationWeight as number) : 0.5)
  );
  // residual 有界 [0.75, 1.25] × 每镜视觉残余，确保 deterministic 且不被主观权重放大失控
  const residualVisual = shotCount * RESIDUAL_VISUAL_SEC_PER_SHOT * (0.75 + 0.5 * importance);
  return narrationEst + residualVisual;
}

/**
 * 有界加权分配（Phase 1D）：把 total 按 weights 分配，且每项落在 [mins[i], maxs[i]]。
 * 命中边界的项固定后，剩余预算在自由项间按权重重分配（water-filling）。
 * 数学不可行时返回明确 warning（MIN_CONSTRAINT / MAX_CONSTRAINT），绝不静默漂移。
 */
export function boundedWeightedAllocation(
  total: number,
  weights: number[],
  mins: number[],
  maxs: number[]
): { values: number[]; warning: "MIN_CONSTRAINT" | "MAX_CONSTRAINT" | null } {
  const n = weights.length;
  if (n === 0) return { values: [], warning: null };
  const EPS = 1e-6;

  const sumMin = mins.reduce((a, b) => a + b, 0);
  const sumMax = maxs.reduce((a, b) => a + b, 0);
  // 不可行：全 min 已超预算（镜头太多 / 目标太短）
  if (sumMin > total + EPS) return { values: mins.slice(), warning: "MIN_CONSTRAINT" };
  // 不可行：全 max 仍填不满（镜头太少 / 目标太长）
  if (sumMax < total - EPS) return { values: maxs.slice(), warning: "MAX_CONSTRAINT" };

  const w: number[] = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const allZero = w.reduce((a, b) => a + b, 0) === 0;
  if (allZero) for (let i = 0; i < n; i++) w[i] = 1; // 全零 → 均权

  const values = new Array<number>(n).fill(0);
  const fixed = new Array<boolean>(n).fill(false);
  let budget = total;

  for (let guard = 0; guard <= n + 2; guard++) {
    const free: number[] = [];
    let wsum = 0;
    for (let i = 0; i < n; i++) if (!fixed[i]) { free.push(i); wsum += w[i]; }
    if (free.length === 0) break;

    if (wsum <= 0) {
      const each = budget / free.length;
      for (const i of free) values[i] = Math.min(maxs[i], Math.max(mins[i], each));
      break;
    }

    let clamped = false;
    for (const i of free) {
      const raw = budget * (w[i] / wsum);
      if (raw < mins[i] - EPS) {
        values[i] = mins[i];
        fixed[i] = true;
        budget -= mins[i];
        clamped = true;
      } else if (raw > maxs[i] + EPS) {
        values[i] = maxs[i];
        fixed[i] = true;
        budget -= maxs[i];
        clamped = true;
      }
    }
    if (!clamped) {
      let wsum2 = 0;
      const free2: number[] = [];
      for (let i = 0; i < n; i++) if (!fixed[i]) { free2.push(i); wsum2 += w[i]; }
      for (const i of free2) values[i] = budget * (w[i] / wsum2);
      break;
    }
  }
  return { values, warning: null };
}

/** 浮点残差归到最后一项，使 Σ 精确对齐 total（误差 ≤ 0.001） */
function withResidual(values: number[], total: number): number[] {
  if (values.length === 0) return values;
  const rounded = values.map(round3);
  const sum = rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] = round3(rounded[rounded.length - 1] + (total - sum));
  return rounded;
}

/**
 * 主入口：targetDuration + Beat 权重 + shotPurpose → beat/shot 时长。
 */
export function planNarrativeDuration(params: {
  targetDurationSec: number;
  beats: DurationPlanBeat[];
  storyboard: DurationPlanShot[];
}): DurationPlanResult {
  const { targetDurationSec, beats, storyboard } = params;
  const warnings: string[] = [];

  // 1) 按 beatId 分组（保 beats[] 顺序，storyboard 独有的 beat 追加在后）
  const shotsByBeat = new Map<string, DurationPlanShot[]>();
  for (const s of storyboard) {
    const bid = (s.beatId && s.beatId.trim()) || "__unassigned__";
    if (!shotsByBeat.has(bid)) shotsByBeat.set(bid, []);
    shotsByBeat.get(bid)!.push(s);
  }
  const orderedBeatIds: string[] = [];
  const seen = new Set<string>();
  for (const b of beats) {
    if (shotsByBeat.has(b.beatId) && !seen.has(b.beatId)) {
      orderedBeatIds.push(b.beatId);
      seen.add(b.beatId);
    }
  }
  for (const bid of shotsByBeat.keys()) if (!seen.has(bid)) orderedBeatIds.push(bid);

  const beatDurations: Record<string, number> = {};
  const shotDurations: Record<string, number> = {};
  const narrationFloors: Record<string, number> = {};

  if (orderedBeatIds.length === 0) {
    return { beatDurations, shotDurations, narrationFloors, totalDurationSec: 0, warnings };
  }

  // 2) Beat 级预算（Phase 2）：主依据 = estimateNarrationDurationSec(beat.narration)；
  //    空旁白 Beat 保留 shot 数 × 视觉残余；estimatedNarrationWeight 仅作 residual 次级调节。
  //    每 Beat 上下界 = 其 shot 数 × [MIN, MAX]，保证 Beat 内可容纳。
  const beatById = new Map(beats.map((b) => [b.beatId, b]));
  const beatCounts = orderedBeatIds.map((bid) => shotsByBeat.get(bid)!.length);
  const beatWeights = orderedBeatIds.map((bid, i) => {
    const b = beatById.get(bid);
    return beatTimingWeight(b?.narration, beatCounts[i], b?.estimatedNarrationWeight);
  });
  const beatMins = beatCounts.map((c) => c * MIN_SHOT_DURATION_SEC);
  const beatMaxs = beatCounts.map((c) => c * MAX_SHOT_DURATION_SEC);

  const beatAlloc = boundedWeightedAllocation(targetDurationSec, beatWeights, beatMins, beatMaxs);
  if (beatAlloc.warning) warnings.push(`BEAT_${beatAlloc.warning}`);
  // 不可行(warning)时保留 best-effort 边界值，不强行凑 target（否则会产生负时长）
  const beatValues = beatAlloc.warning
    ? beatAlloc.values.map(round3)
    : withResidual(beatAlloc.values, targetDurationSec);

  // 3) Beat 内 Shot 分配（Closure）：narration-aware。
  //    权重 = 旁白估时(主) + shotPurpose 视觉残余(次)；
  //    有旁白镜头下界 = 估时+pad（narration floor），确保 planned ≥ voice，收敛 Math.max drift。
  orderedBeatIds.forEach((bid, bi) => {
    const bDur = beatValues[bi];
    beatDurations[bid] = round3(bDur);
    const shots = shotsByBeat.get(bid)!;
    const shotNarrEst = shots.map((s) => estimateNarrationDurationSec(s.narration ?? "").durationSec);
    const sw = shots.map((s, si) => shotNarrEst[si] + shotPurposeWeight(s.shotPurpose) * SHOT_VISUAL_RESIDUAL_SEC);
    const smins = shots.map((_, si) =>
      shotNarrEst[si] > 0
        ? Math.min(MAX_SHOT_DURATION_SEC, Math.max(MIN_SHOT_DURATION_SEC, shotNarrEst[si] + NARRATION_PLANNING_PAD_SEC))
        : MIN_SHOT_DURATION_SEC
    );
    const smaxs = shots.map(() => MAX_SHOT_DURATION_SEC);
    shots.forEach((s, si) => {
      if (s.shotId) narrationFloors[s.shotId] = round3(smins[si]);
    });
    const sAlloc = boundedWeightedAllocation(bDur, sw, smins, smaxs);
    if (sAlloc.warning) {
      // narration floor 放不下 → 明确告警（不扩大 target，不偷偷违反 bounds）
      const floorTotal = smins.reduce((a, b) => a + b, 0);
      const narratedShotCount = shotNarrEst.filter((e) => e > 0).length;
      warnings.push(
        `SHOT_${sAlloc.warning}@${bid}:beatDur=${round3(bDur)},floorTotal=${round3(floorTotal)},deficit=${round3(Math.max(0, floorTotal - bDur))},narrated=${narratedShotCount}`
      );
    }
    const vals = sAlloc.warning ? sAlloc.values.map(round3) : withResidual(sAlloc.values, bDur);
    shots.forEach((s, si) => {
      if (s.shotId) shotDurations[s.shotId] = vals[si];
    });
  });

  const totalDurationSec = round3(
    Object.values(shotDurations).reduce((a, b) => a + b, 0)
  );
  return { beatDurations, shotDurations, narrationFloors, totalDurationSec, warnings };
}
