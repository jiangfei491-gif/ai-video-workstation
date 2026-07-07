import type { StoryboardShot, T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

/** 当前编导分镜镜数 */
export function directorShotCount(state: T2VWorkbenchState): number {
  return state.director?.storyboard?.length ?? 0;
}

/** 分镜内容指纹 — 镜数相同但 action/narration 变更时也能识别过期 */
export function storyboardFingerprint(storyboard?: StoryboardShot[]): string {
  if (!storyboard?.length) return "";
  return storyboard
    .map((sb) =>
      [
        sb.shotId ?? "",
        sb.beatId ?? "",
        sb.action ?? "",
        sb.reaction ?? "",
        sb.narration ?? "",
        sb.visualFocus ?? "",
        sb.duration ?? "",
      ].join("\t")
    )
    .join("\n");
}

export function currentStoryboardFingerprint(state: T2VWorkbenchState): string {
  return storyboardFingerprint(state.director?.storyboard);
}

/** EditGraph 镜数或分镜内容与当前编导不一致 */
export function isEditGraphStale(state: T2VWorkbenchState): boolean {
  const shots = directorShotCount(state);
  const clips = state.editGraph?.timeline?.video?.length ?? 0;
  if (shots > 0 && clips > 0 && clips !== shots) return true;

  const fp = currentStoryboardFingerprint(state);
  const graphFp = state.editGraph?.storyboardFingerprint;
  if (fp && graphFp && fp !== graphFp) return true;
  // 旧工程未写入指纹：有分镜与剪辑时视为过期，进入剪辑页会按当前分镜重建
  if (fp && shots > 0 && clips > 0 && !graphFp) return true;

  return false;
}

/** Director Plan 镜数或分镜内容与当前编导不一致 */
export function isDirectorPlanStale(state: T2VWorkbenchState): boolean {
  const shots = directorShotCount(state);
  const planClips = state.directorPlan?.clips?.length ?? 0;
  if (shots > 0 && planClips > 0 && planClips !== shots) return true;

  const fp = currentStoryboardFingerprint(state);
  const planFp = state.directorPlan?.meta?.storyboardFingerprint;
  if (fp && planFp && fp !== planFp) return true;

  return false;
}

export function hasStaleDownstream(state: T2VWorkbenchState): boolean {
  return isEditGraphStale(state) || isDirectorPlanStale(state);
}

/** 分镜变更后清空旧剪辑/Plan，避免 80 镜时间线绑 30 镜脚本 */
export function clearDownstreamForDirectorChange(): Partial<T2VWorkbenchState> {
  return {
    editGraph: null,
    editSequence: null,
    editPlan: null,
    directorPlan: null,
    openCutCommands: null,
    finalEditVideoUrl: null,
    editRenderJobId: null,
    editCoverImageUrl: null,
  };
}

/** 分镜镜数或内容变化时是否应丢弃下游工程 */
export function shouldClearDownstream(
  prev: T2VWorkbenchState,
  nextStoryboard: StoryboardShot[]
): boolean {
  const prevBoard = prev.director?.storyboard ?? [];
  if (!prevBoard.length || !nextStoryboard.length) return false;
  if (prevBoard.length !== nextStoryboard.length) return true;
  return storyboardFingerprint(prevBoard) !== storyboardFingerprint(nextStoryboard);
}
