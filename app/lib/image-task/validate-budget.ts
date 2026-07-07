import type { ImageTask } from "./types";

export class ImageBudgetViolationError extends Error {
  readonly plannedCount: number;
  readonly imageBudget: number;

  constructor(plannedCount: number, imageBudget: number) {
    super(
      `成本保护失败：ImageTask 数量 ${plannedCount} 超过 imageBudget ${imageBudget}。禁止 fallback 到 1:1 超预算生图。`
    );
    this.name = "ImageBudgetViolationError";
    this.plannedCount = plannedCount;
    this.imageBudget = imageBudget;
  }
}

/** 硬性校验：plannedImageTaskCount <= imageBudget */
export function assertImageBudgetCompliance(
  imageTasks: ImageTask[],
  imageBudget: number
): void {
  if (imageTasks.length > imageBudget) {
    throw new ImageBudgetViolationError(imageTasks.length, imageBudget);
  }
}

export function assertGenerationUnitCount(
  generationUnitCount: number,
  imageBudget: number
): void {
  if (generationUnitCount > imageBudget) {
    throw new ImageBudgetViolationError(generationUnitCount, imageBudget);
  }
}
