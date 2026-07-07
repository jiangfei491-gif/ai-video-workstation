/**
 * ImageTask client-safe 入口（可被打包进 "use client" 模块）。
 * 禁止在此 re-export adapt-generation-input / plan-budget 等 server-only 模块。
 */
export type {
  ImageTask,
  ImageTaskMapping,
  ImageTaskPriority,
  BuildCompatImageTasksInput,
  BuildCompatImageTasksResult,
} from "./types";

export {
  shotIdFromIndex,
  imageTaskIdFromIndex,
  shotIndexFromShotId,
  resolveShotIdForIndex,
} from "../shared/shot-id";
export { buildCompatImageTasksFromDirector, demoManyToOneMapping } from "./build-compat-tasks";
export {
  assertImageBudgetCompliance,
  assertGenerationUnitCount,
  ImageBudgetViolationError,
} from "./validate-budget";
export {
  resolveFrameForShot,
  resolveFrameAssetForShot,
  resolveImageQcForShot,
  resolveImageTaskIdForShotIndex,
  resolveImageTaskIdForShotId,
  resolveImageTaskForShotIndex,
} from "./resolve-frames";
export { dualWriteGenerationResult, imageTaskHasFrame } from "./sync-dual-write";
