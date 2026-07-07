import type { ShotTimelineEntry } from "@/app/lib/consistency-engine/types/world-style-camera";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { resolveShotIdForIndex } from "./shot-id";

export function resolveImageTaskIdForShotIndex(
  state: Pick<T2VWorkbenchState, "imageTaskMapping" | "director">,
  shotIndex: number
): string | undefined {
  const shotId = resolveShotIdForIndex(state.director?.storyboard, shotIndex);
  return state.imageTaskMapping?.shotToImageTaskMap[shotId];
}

export function resolveImageTaskIdForShotId(
  state: Pick<T2VWorkbenchState, "imageTaskMapping">,
  shotId: string
): string | undefined {
  return state.imageTaskMapping?.shotToImageTaskMap[shotId];
}

/** 通过 Mapping 解析 Shot 对应成片 URL（优先 imageTaskFrames，回退 shotFrames） */
export function resolveFrameForShot(
  state: Pick<
    T2VWorkbenchState,
    "shotFrames" | "imageTaskFrames" | "imageTaskMapping" | "director"
  >,
  shotIndex: number
): string | undefined {
  const taskId = resolveImageTaskIdForShotIndex(state, shotIndex);
  if (taskId && state.imageTaskFrames?.[taskId]) {
    return state.imageTaskFrames[taskId];
  }
  return state.shotFrames?.[shotIndex];
}

export function resolveFrameAssetForShot(
  state: Pick<
    T2VWorkbenchState,
    "shotFrameAssets" | "imageTaskFrameAssets" | "imageTaskMapping" | "director"
  >,
  shotIndex: number
): string | undefined {
  const taskId = resolveImageTaskIdForShotIndex(state, shotIndex);
  if (taskId && state.imageTaskFrameAssets?.[taskId]) {
    return state.imageTaskFrameAssets[taskId];
  }
  return state.shotFrameAssets?.[shotIndex];
}

/** 通过 Mapping 获取 ImageTask 级 QC 时间轴（回退 shotTimeline） */
export function resolveImageQcForShot(
  state: Pick<
    T2VWorkbenchState,
    "shotTimeline" | "imageTaskTimeline" | "imageTaskMapping" | "director"
  >,
  shotIndex: number
): ShotTimelineEntry | undefined {
  const taskId = resolveImageTaskIdForShotIndex(state, shotIndex);
  if (taskId && state.imageTaskTimeline?.[taskId]) {
    return state.imageTaskTimeline[taskId];
  }
  return state.shotTimeline?.[shotIndex];
}

export function resolveImageTaskForShotIndex(
  state: Pick<T2VWorkbenchState, "imageTasks" | "imageTaskMapping" | "director">,
  shotIndex: number
): import("./types").ImageTask | undefined {
  const taskId = resolveImageTaskIdForShotIndex(state, shotIndex);
  if (!taskId) return undefined;
  return state.imageTasks?.find((t) => t.imageTaskId === taskId);
}
