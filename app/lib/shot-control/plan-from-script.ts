import { clampDurationMinutes, estimateWordCount } from "@/app/lib/materials/script-evolution/duration-config";
import type { PipelineMode } from "@/app/lib/pipeline-mode";
import {
  clampImageBudget,
  resolveImageBudget,
  type ImageBudgetMode,
} from "./image-budget";

export const MIN_SHOT_COUNT = 1;
export const MIN_SHOT_DURATION_SEC = 1;
/** @deprecated Phase 7 后由配音驱动镜长；保留供 t2v / 旧链路 */
export const DEFAULT_T2I_SHOT_DURATION_SEC = 6;

export type ShotPlan = {
  targetDurationMinutes: number;
  targetDurationSec: number;
  imageBudget: number;
  imageBudgetMode: ImageBudgetMode;
};

/** 从脚本标题或字数推断目标成片分钟数 */
export function parseTargetDurationMinutes(scriptText: string, title?: string): number | null {
  const durationMatch = title?.match(/(\d+(?:\.\d+)?)\s*分钟/);
  if (durationMatch) {
    return clampDurationMinutes(Number(durationMatch[1]));
  }

  const chars = scriptText.replace(/\s/g, "").length;
  if (chars < 80) return null;

  for (let minutes = 0.5; minutes <= 60; minutes += 0.5) {
    if (estimateWordCount(minutes) >= chars * 0.92) {
      return clampDurationMinutes(minutes);
    }
  }
  return 60;
}

/**
 * 规划目标成片时长 + 图片预算。
 * 不再用 targetDurationSec / shotDurationSec 推导 storyboard 镜数。
 */
export function buildShotPlan(params: {
  targetDurationMinutes?: number | null;
  scriptText?: string;
  scriptTitle?: string;
  pipelineMode: PipelineMode;
  imageBudgetMode?: ImageBudgetMode;
  imageBudget?: number;
  /** @deprecated t2v 兼容；t2i 忽略 */
  shotDurationSec?: number;
  /** @deprecated t2v 兼容；t2i 忽略 */
  shotCount?: number;
}): ShotPlan {
  const targetDurationMinutes =
    params.targetDurationMinutes ??
    parseTargetDurationMinutes(params.scriptText ?? "", params.scriptTitle) ??
    1;
  const targetDurationSec = Math.round(targetDurationMinutes * 60);

  const imageBudgetMode = params.imageBudgetMode ?? "standard";
  const imageBudget = resolveImageBudget({
    targetDurationSec,
    mode: imageBudgetMode,
    customBudget: params.imageBudget,
  });

  return {
    targetDurationMinutes,
    targetDurationSec,
    imageBudget,
    imageBudgetMode,
  };
}

export function clampShotCount(value: number, pipelineMode: PipelineMode): number {
  const n = Math.floor(value) || MIN_SHOT_COUNT;
  if (pipelineMode === "t2i") {
    return Math.max(MIN_SHOT_COUNT, n);
  }
  return Math.max(MIN_SHOT_COUNT, Math.min(30, n));
}

export function clampShotDurationSec(value: number, pipelineMode: PipelineMode): number {
  const n = Math.floor(value) || MIN_SHOT_DURATION_SEC;
  if (pipelineMode === "t2i") {
    return Math.max(MIN_SHOT_DURATION_SEC, n);
  }
  return Math.max(MIN_SHOT_DURATION_SEC, Math.min(60, n));
}

export function formatDurationMinutesLabel(minutes: number): string {
  if (minutes >= 1 && Math.abs(minutes - Math.round(minutes)) < 0.05) {
    return `${Math.round(minutes)} 分钟`;
  }
  return `${minutes} 分钟`;
}

export { clampImageBudget };
