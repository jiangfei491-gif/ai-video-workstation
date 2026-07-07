import type { PipelineMode } from "@/app/lib/pipeline-mode";

/**
 * t2v：使用工作台 shotCount。
 * t2i：imageBudget 仅约束 ImageTask 数量，不再作为 storyboard 镜数。
 */
export function resolveDirectorShotCount(params: {
  pipelineMode: PipelineMode;
  shotCount: number;
  imageBudget?: number;
}): number {
  if (params.pipelineMode === "t2i") {
    return Math.max(1, params.imageBudget ?? 45);
  }
  return Math.max(1, params.shotCount);
}

/** t2i 是否仍使用 legacy 1:1 storyboard=imageBudget 兼容（已废弃） */
export function isLegacyT2iStoryboardBudget(params: {
  pipelineMode: PipelineMode;
}): boolean {
  return false;
}
