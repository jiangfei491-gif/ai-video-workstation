import type { QualityMode } from "@/app/lib/image/providers/types";

/** 单镜四级流水线粗算成本（USD） */
export function estimateTieredShotCostUsd(mode: QualityMode): number {
  switch (mode) {
    case "fast":
      return 0.005;
    case "standard":
      // FLUX 草稿 + 评分 + FLUX dev 精修 + 1 次 QC（无 GPT Image）
      return 0.03;
    case "advanced":
      // 标准 + GPT Image 精修 + QC + 修复
      return 0.08;
    case "flagship":
      return 0.12;
    default:
      return 0.03;
  }
}

export const SHOT_IMAGE_COST_USD = estimateTieredShotCostUsd("standard");

export const SHOT_IMAGE_SEC_EST = 18;

export function formatUsd(n: number): string {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
