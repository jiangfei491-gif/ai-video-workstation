import { ledgerFromDirector } from "@/app/lib/cost-ledger/merge";
import {
  buildCompatImageTasksFromDirector,
  assertImageBudgetCompliance,
} from "@/app/lib/image-task";
import { shotIdFromIndex } from "@/app/lib/image-task/shot-id";
import { DEFAULT_T2I_SHOT_DURATION_SEC } from "@/app/lib/shot-control/plan-from-script";
import type { DirectorPipelineResult } from "@/app/lib/director/types";
import { pickLongestScript } from "@/app/lib/workbench-persist/script-cache";
import type {
  DirectorShot,
  DirectorState,
  StoryboardShot,
  T2VWorkbenchState,
} from "@/app/lib/workbench-persist/types";

function storyboardWithShotIds(storyboard: StoryboardShot[]): StoryboardShot[] {
  return storyboard.map((sb, i) => ({
    ...sb,
    shotId: sb.shotId ?? shotIdFromIndex(i),
  }));
}

/** 将 runDirectorPipeline 结果写回工作台状态 */
export function applyDirectorPipelineToWorkbench(
  state: T2VWorkbenchState,
  data: DirectorPipelineResult,
  opts?: { preserveGeneratedMedia?: boolean }
): Partial<T2VWorkbenchState> {
  const isT2i = state.pipelineMode === "t2i";
  const rawStoryboard = (data.storyboard ?? []) as StoryboardShot[];
  // Phase1：保留 Duration Planner 已规划的各异镜长；仅当缺失/非法/≤0 才回退全局 shotDurationSec。
  // （此前无条件覆盖为 shotDurationSec，把 Planner 的 [2,12]s 分配全抹成固定值 → 总时长失控）
  const clipDurationSec = state.shotDurationSec || DEFAULT_T2I_SHOT_DURATION_SEC;
  const storyboard = isT2i
    ? rawStoryboard.map((sb) => ({
        ...sb,
        duration:
          Number.isFinite(sb.duration) && sb.duration > 0 ? sb.duration : clipDurationSec,
      }))
    : rawStoryboard;

  const shotConsistency = data.shotConsistency ?? [];
  const prompts: DirectorShot[] = (data.prompts ?? []).map((p, i) => ({
    sceneNumber: p.sceneNumber,
    providerPrompt: p.providerPrompt,
    duration: state.shotDurationSec,
    consistency: shotConsistency[i],
  }));

  const fullScript = pickLongestScript(state.sourceScript, data.script);
  const directorDraft: DirectorState = {
    title: data.title,
    script: fullScript || data.script,
    storyboard,
    prompts,
  };

  const hasPlannedTasks =
    isT2i && data.imageTasks?.length && data.imageTaskMapping?.shotToImageTaskMap;

  let imageTasks;
  let imageTaskMapping;
  let finalStoryboard: StoryboardShot[];

  if (hasPlannedTasks) {
    imageTasks = data.imageTasks!;
    imageTaskMapping = data.imageTaskMapping!;
    finalStoryboard = storyboardWithShotIds(storyboard);
    assertImageBudgetCompliance(imageTasks, state.imageBudget ?? 45);
  } else {
    const compat = buildCompatImageTasksFromDirector({ director: directorDraft });
    imageTasks = compat.imageTasks;
    imageTaskMapping = compat.mapping;
    finalStoryboard = compat.storyboardWithShotIds;
  }

  const director: DirectorState = {
    ...directorDraft,
    storyboard: finalStoryboard,
  };

  const preserve = opts?.preserveGeneratedMedia ?? false;
  const mediaReset = preserve
    ? {}
    : {
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
        veoStatus: "idle" as const,
        veoError: null,
        veoSuccessMessage: null,
      };

  return {
    sourceScript: fullScript || state.sourceScript,
    director,
    imageTasks,
    imageTaskMapping,
    ...(data.narrativeBeats ? { narrativeBeats: data.narrativeBeats } : {}),
    activeShotIdx: 0,
    ...(data.visualSettings
      ? {
          projectBible: data.visualSettings.projectBible,
          projectStyle: data.visualSettings.projectStyle,
          stylePresetId: data.visualSettings.stylePresetId,
          worldBible: data.visualSettings.worldBible,
          cameraTemplateId: data.visualSettings.cameraTemplateId,
        }
      : {}),
    ...mediaReset,
    ...(data.costDetail
      ? { projectCostLedger: ledgerFromDirector(data.costDetail) }
      : {}),
  };
}
