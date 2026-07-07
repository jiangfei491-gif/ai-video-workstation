import type { ImageProviderId } from "./types";

/** 单张粗算 USD（供统计与调度） */
export const PROVIDER_COST_USD: Record<ImageProviderId, number> = {
  "flux-schnell": 0.003,
  "flux-dev": 0.025,
  "gpt-image-1": 0.04,
  "gpt-image-2": 0.06,
  "imagen-3": 0.04,
};

export function estimateProviderCostUsd(
  providerId: ImageProviderId,
  count = 1
): number {
  return (PROVIDER_COST_USD[providerId] ?? 0.05) * count;
}

/** Score QC Vision 粗算 */
export const SCORE_QC_COST_USD = 0.002;
export const FINAL_QC_COST_USD = 0.003;
