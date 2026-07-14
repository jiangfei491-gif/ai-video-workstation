import type { ImageTaskMapping } from "./types";
import { imageTaskIdFromIndex, shotIdFromIndex } from "./shot-id";
import type { StoryboardShot, T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export function hasGeneratedWorkbenchMedia(
  state: Pick<T2VWorkbenchState, "shotFrames" | "imageTaskFrames" | "batchResults">
): boolean {
  if (Object.keys(state.shotFrames ?? {}).length > 0) return true;
  if (Object.keys(state.imageTaskFrames ?? {}).length > 0) return true;
  return Object.values(state.batchResults ?? {}).some((r) => r?.status === "success");
}

export function canPreserveDirectorMediaByShotCount(
  prev: T2VWorkbenchState,
  nextShotCount: number
): boolean {
  const prevCount = prev.director?.storyboard?.length ?? 0;
  return prevCount > 0 && prevCount === nextShotCount;
}

function trimIndexMap<T>(map: Record<number, T> | undefined, maxIndex: number): Record<number, T> {
  const out: Record<number, T> = {};
  if (!map) return out;
  for (const [key, value] of Object.entries(map)) {
    const idx = Number(key);
    if (Number.isFinite(idx) && idx >= 0 && idx < maxIndex) {
      out[idx] = value;
    }
  }
  return out;
}

/** 编导重跑后按 shotId / shotIndex 保留并 remap 已生成图片映射 */
export function remapPreservedDirectorMedia(
  prev: T2VWorkbenchState,
  finalStoryboard: StoryboardShot[],
  imageTaskMapping: ImageTaskMapping
): Partial<T2VWorkbenchState> {
  const n = finalStoryboard.length;
  const prevShotToTask = prev.imageTaskMapping?.shotToImageTaskMap ?? {};
  const newShotToTask = imageTaskMapping.shotToImageTaskMap;

  const remappedImageTaskFrames: Record<string, string> = {};
  const remappedImageTaskFrameAssets: Record<string, string> = {};
  const remappedImageTaskTimeline: Record<string, NonNullable<T2VWorkbenchState["imageTaskTimeline"]>[string]> =
    {};

  for (const [shotId, newTaskId] of Object.entries(newShotToTask)) {
    const oldTaskId = prevShotToTask[shotId];
    if (!oldTaskId) continue;
    const url = prev.imageTaskFrames?.[oldTaskId];
    if (url) remappedImageTaskFrames[newTaskId] = url;
    const assetId = prev.imageTaskFrameAssets?.[oldTaskId];
    if (assetId) remappedImageTaskFrameAssets[newTaskId] = assetId;
    const timeline = prev.imageTaskTimeline?.[oldTaskId];
    if (timeline) remappedImageTaskTimeline[newTaskId] = timeline;
  }

  // compat 1:1：按镜序兜底（shotId 未变时 taskId 通常也不变）
  for (let i = 0; i < n; i++) {
    const shotId = finalStoryboard[i]?.shotId ?? shotIdFromIndex(i);
    const newTaskId = newShotToTask[shotId] ?? imageTaskIdFromIndex(i);
    const oldTaskId = prevShotToTask[shotId] ?? imageTaskIdFromIndex(i);
    if (!remappedImageTaskFrames[newTaskId] && prev.imageTaskFrames?.[oldTaskId]) {
      remappedImageTaskFrames[newTaskId] = prev.imageTaskFrames[oldTaskId];
    }
    if (!remappedImageTaskFrameAssets[newTaskId] && prev.imageTaskFrameAssets?.[oldTaskId]) {
      remappedImageTaskFrameAssets[newTaskId] = prev.imageTaskFrameAssets[oldTaskId];
    }
    if (!remappedImageTaskTimeline[newTaskId] && prev.imageTaskTimeline?.[oldTaskId]) {
      remappedImageTaskTimeline[newTaskId] = prev.imageTaskTimeline[oldTaskId];
    }
  }

  return {
    testResult: null,
    shotLock: null,
    prodResult: null,
    batchRunning: false,
    batchResults: trimIndexMap(prev.batchResults, n),
    shotFrames: trimIndexMap(prev.shotFrames, n),
    shotFrameAssets: trimIndexMap(prev.shotFrameAssets, n),
    shotImageMeta: trimIndexMap(prev.shotImageMeta, n),
    shotFavorites: trimIndexMap(prev.shotFavorites, n),
    shotTimeline: trimIndexMap(prev.shotTimeline, n),
    imageTaskFrames: remappedImageTaskFrames,
    imageTaskFrameAssets: remappedImageTaskFrameAssets,
    imageTaskTimeline: remappedImageTaskTimeline,
    veoStatus: "idle",
    veoError: null,
    veoSuccessMessage: null,
  };
}

export function buildDirectorMediaPatch(
  prev: T2VWorkbenchState,
  finalStoryboard: StoryboardShot[],
  imageTaskMapping: ImageTaskMapping
): Partial<T2VWorkbenchState> {
  const hadMedia = hasGeneratedWorkbenchMedia(prev);
  const canPreserve = canPreserveDirectorMediaByShotCount(prev, finalStoryboard.length);
  if (hadMedia && canPreserve) {
    return remapPreservedDirectorMedia(prev, finalStoryboard, imageTaskMapping);
  }
  return {
    testResult: null,
    shotLock: null,
    prodResult: null,
    batchRunning: false,
    batchResults: {},
    shotFrames: {},
    shotFrameAssets: {},
    shotImageMeta: {},
    shotFavorites: {},
    shotTimeline: {},
    imageTaskFrames: {},
    imageTaskFrameAssets: {},
    imageTaskTimeline: {},
    veoStatus: "idle",
    veoError: null,
    veoSuccessMessage: null,
  };
}
