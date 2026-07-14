import { ledgerFromDirector } from "@/app/lib/cost-ledger/merge";
import {
  clearDownstreamForDirectorChange,
  shouldClearDownstream,
} from "@/app/lib/ai-director/downstream-stale";
import {
  buildCompatImageTasksFromDirector,
  assertImageBudgetCompliance,
} from "@/app/lib/image-task/client";
import { pickLongestScript } from "@/app/lib/workbench-persist/script-cache";
import { DEFAULT_T2I_SHOT_DURATION_SEC } from "@/app/lib/shot-control/plan-from-script";
import { resolveDirectorShotCount } from "@/app/lib/shot-control/resolve-director-shot-count";
import type { ImageTask, ImageTaskMapping } from "@/app/lib/image-task/types";
import type { NarrativeBeat } from "@/app/lib/narrative/client";
import type {
  DirectorShot,
  StoryboardShot,
  T2VWorkbenchState,
} from "@/app/lib/workbench-persist/types";
import { buildDirectorMediaPatch } from "@/app/lib/image-task/remap-director-media";
import { shotIdFromIndex } from "@/app/lib/shared/shot-id";

export type DirectorApiResponse = {
  title: string;
  script: string;
  storyboard: StoryboardShot[];
  prompts: { sceneNumber: number; providerPrompt: string }[];
  shotConsistency?: DirectorShot["consistency"][];
  visualSettings?: {
    projectBible: T2VWorkbenchState["projectBible"];
    projectStyle: string;
    stylePresetId: T2VWorkbenchState["stylePresetId"];
    worldBible: T2VWorkbenchState["worldBible"];
    cameraTemplateId: T2VWorkbenchState["cameraTemplateId"];
  };
  costDetail?: Parameters<typeof ledgerFromDirector>[0];
  narrativeBeats?: NarrativeBeat[];
  imageTasks?: ImageTask[];
  imageTaskMapping?: ImageTaskMapping;
};

function storyboardWithShotIds(storyboard: StoryboardShot[]): StoryboardShot[] {
  return storyboard.map((sb, i) => ({
    ...sb,
    shotId: sb.shotId ?? shotIdFromIndex(i),
  }));
}

/** 将 /api/director 响应合并进工作台（续跑时始终基于最新 getT2VState） */
export function buildDirectorWorkbenchPatch(
  prev: T2VWorkbenchState,
  data: DirectorApiResponse
): Partial<T2VWorkbenchState> {
  const isT2i = prev.pipelineMode === "t2i";
  const clipDurationSec = isT2i
    ? prev.shotDurationSec || DEFAULT_T2I_SHOT_DURATION_SEC
    : prev.shotDurationSec;
  const rawStoryboard = (data.storyboard ?? []) as StoryboardShot[];
  // Phase 1：保留 Duration Planner 已规划的镜长；仅当缺失/非法/≤0 才回退全局 shotDurationSec(legacy 兼容)
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
    duration: clipDurationSec,
    consistency: shotConsistency[i],
  }));

  const fullScript = pickLongestScript(prev.sourceScript, data.script);
  const directorDraft = {
    title: data.title,
    script: fullScript || data.script,
    storyboard,
    prompts,
  };

  const hasPlannedTasks =
    isT2i && data.imageTasks?.length && data.imageTaskMapping?.shotToImageTaskMap;

  let imageTasks: ImageTask[];
  let imageTaskMapping: ImageTaskMapping;
  let finalStoryboard: StoryboardShot[];

  if (hasPlannedTasks) {
    imageTasks = data.imageTasks!;
    imageTaskMapping = data.imageTaskMapping!;
    finalStoryboard = storyboardWithShotIds(storyboard);
    assertImageBudgetCompliance(imageTasks, prev.imageBudget ?? 45);
  } else {
    const compat = buildCompatImageTasksFromDirector({ director: directorDraft });
    imageTasks = compat.imageTasks;
    imageTaskMapping = compat.mapping;
    finalStoryboard = compat.storyboardWithShotIds;
  }

  const downstreamReset =
    prev.director && shouldClearDownstream(prev, storyboard)
      ? clearDownstreamForDirectorChange()
      : {};

  const mediaPatch = buildDirectorMediaPatch(prev, finalStoryboard, imageTaskMapping);

  return {
    sourceScript: fullScript || prev.sourceScript,
    director: {
      title: data.title,
      script: fullScript || data.script,
      storyboard: finalStoryboard,
      prompts,
    },
    imageTasks,
    imageTaskMapping,
    ...(data.narrativeBeats ? { narrativeBeats: data.narrativeBeats } : {}),
    activeShotIdx: 0,
    ...downstreamReset,
    ...(data.visualSettings
      ? {
          projectBible: data.visualSettings.projectBible,
          projectStyle: data.visualSettings.projectStyle,
          stylePresetId: data.visualSettings.stylePresetId,
          worldBible: data.visualSettings.worldBible,
          cameraTemplateId: data.visualSettings.cameraTemplateId,
        }
      : {}),
    ...mediaPatch,
    ...(data.costDetail
      ? { projectCostLedger: ledgerFromDirector(data.costDetail) }
      : { projectCostLedger: null }),
  };
}

export function buildDirectorRequestBody(state: T2VWorkbenchState): Record<string, unknown> {
  const topic = state.topic?.trim() ?? "";
  const pipelineMode = state.pipelineMode ?? "t2v";
  return {
    topic,
    shotCount: resolveDirectorShotCount({
      pipelineMode,
      shotCount: state.shotCount,
      imageBudget: state.imageBudget ?? 45,
    }),
    shotDurationSec: state.shotDurationSec,
    pipelineMode,
    imageBudget: state.imageBudget,
    targetDurationMinutes: state.targetDurationMinutes,
    characterIds: state.characterIds,
    sceneIds: state.sceneIds,
    propIds: state.propIds ?? [],
    projectBible: state.projectBible,
    projectStyle: state.projectStyle,
    ...(state.sourceScript?.trim()
      ? {
          script: state.sourceScript.trim(),
          title: state.sourceScriptLabel?.trim() || topic,
        }
      : {}),
  };
}
