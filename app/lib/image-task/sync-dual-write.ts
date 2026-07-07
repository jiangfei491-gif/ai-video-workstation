import type { ShotTimelineEntry } from "@/app/lib/consistency-engine/types/world-style-camera";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { ImageTask } from "./types";

export type GenerationFrameResult = {
  url: string;
  assetId: string;
  model?: string;
  source?: string;
};

/** 生图完成后双写：ImageTask 级 + 兼容 shotIndex 级 */
export function dualWriteGenerationResult(params: {
  task: ImageTask;
  frame: GenerationFrameResult;
  timeline?: ShotTimelineEntry;
  aspectRatio?: string;
  prev: Pick<
    T2VWorkbenchState,
    | "shotFrames"
    | "shotFrameAssets"
    | "shotImageMeta"
    | "shotTimeline"
    | "imageTaskFrames"
    | "imageTaskFrameAssets"
    | "imageTaskTimeline"
  >;
}): Partial<T2VWorkbenchState> {
  const { task, frame, timeline, aspectRatio, prev } = params;
  const shotFrames = { ...(prev.shotFrames ?? {}) };
  const shotFrameAssets = { ...(prev.shotFrameAssets ?? {}) };
  const shotImageMeta = { ...(prev.shotImageMeta ?? {}) };
  const shotTimeline = { ...(prev.shotTimeline ?? {}) };
  const imageTaskFrames = { ...(prev.imageTaskFrames ?? {}), [task.imageTaskId]: frame.url };
  const imageTaskFrameAssets = {
    ...(prev.imageTaskFrameAssets ?? {}),
    [task.imageTaskId]: frame.assetId,
  };
  const imageTaskTimeline = { ...(prev.imageTaskTimeline ?? {}) };

  imageTaskFrames[task.imageTaskId] = frame.url;
  imageTaskFrameAssets[task.imageTaskId] = frame.assetId;
  if (timeline) {
    imageTaskTimeline[task.imageTaskId] = timeline;
  }

  const meta = {
    model: frame.model ?? "gpt-image-2",
    source: frame.source ?? "gpt-image-2",
    aspectRatio,
  };

  for (const i of task.sourceShotIndexes) {
    shotFrames[i] = frame.url;
    shotFrameAssets[i] = frame.assetId;
    shotImageMeta[i] = meta;
    if (timeline) shotTimeline[i] = timeline;
  }

  return {
    shotFrames,
    shotFrameAssets,
    shotImageMeta,
    shotTimeline,
    imageTaskFrames,
    imageTaskFrameAssets,
    imageTaskTimeline,
  };
}

export function imageTaskHasFrame(
  state: Pick<T2VWorkbenchState, "imageTaskFrames">,
  task: ImageTask
): boolean {
  return Boolean(state.imageTaskFrames?.[task.imageTaskId]);
}
