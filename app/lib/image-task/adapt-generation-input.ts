import { buildShotFrameRequest } from "@/app/lib/consistency-engine/client/build-shot-frame-request";
import { buildShotMemory } from "@/app/lib/consistency-engine/memory/shot-memory";
import type { ShotConsistencyMeta } from "@/app/lib/consistency-engine/types/shot";
import type { DirectorStoryboardShot } from "@/app/lib/director/types";
import type { DirectorState, T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { imageTaskToQcContext } from "./qc-context";
import { resolveProviderPromptForImageTask } from "./generate-provider-prompt-for-task";
import type { ImageTask } from "./types";

type CharacterRef = { id: string; name: string };
type SceneRef = { id: string; name: string };
type PropRef = { id: string; name: string };

/**
 * ImageTask → 现有 runTieredShotPipeline 输入（ShotFrameRequestBody 形状）。
 */
export function buildShotFrameRequestFromImageTask(
  state: T2VWorkbenchState,
  director: DirectorState,
  task: ImageTask,
  characters: CharacterRef[],
  scenes: SceneRef[],
  props: PropRef[],
  purpose: "final" | "first-frame" = "final"
) {
  const shotIndex = task.sourceShotIndexes[0] ?? 0;
  const prompt =
    resolveProviderPromptForImageTask(task, {
      storyboard: director.storyboard as DirectorStoryboardShot[],
      projectStyle: state.projectStyle,
    }) ||
    director.prompts[shotIndex]?.providerPrompt?.trim() ||
    "";
  const meta = director.prompts[shotIndex]?.consistency;
  const charMap = new Map(characters.map((c) => [c.id, c.name]));
  const sceneMap = new Map(scenes.map((s) => [s.id, s.name]));
  const propMap = new Map(props.map((p) => [p.id, p.name]));

  const characterIds = meta?.characterIds ?? state.characterIds.slice(0, 1);
  const sceneId = meta?.sceneId ?? state.sceneIds[0];
  const propIds = meta?.propIds ?? state.propIds ?? [];
  const inheritFrom = meta?.inheritFrom ?? (shotIndex === 0 ? null : shotIndex - 1);

  const sb = director.storyboard[shotIndex];
  const consistency: ShotConsistencyMeta = meta ?? {
    characterIds,
    sceneId,
    propIds,
    inheritFrom,
    deltaAction: task.actionCoverage[0] ?? sb?.action ?? "",
    deltaCamera: task.cameraIntent ?? sb?.camera ?? "",
    lighting: shotIndex === 0 ? "establish scene lighting" : "same as previous",
  };

  let previousShotSummary: string | undefined;
  if (inheritFrom != null && inheritFrom >= 0) {
    const prevMeta = director.prompts[inheritFrom]?.consistency ?? consistency;
    const memory = buildShotMemory({
      inheritFrom,
      shotIndex,
      storyboard: director.storyboard,
      prompts: director.prompts,
      characterIds: prevMeta.characterIds ?? characterIds,
      sceneId: prevMeta.sceneId ?? sceneId,
      propIds: prevMeta.propIds ?? propIds,
      characterTokensOverride: (prevMeta.characterIds ?? characterIds)
        .map((id) => charMap.get(id))
        .filter(Boolean)
        .map((n) => `@${n}`),
      sceneTokenOverride:
        prevMeta.sceneId && sceneMap.get(prevMeta.sceneId)
          ? `@${sceneMap.get(prevMeta.sceneId)}`
          : null,
      propTokensOverride: (prevMeta.propIds ?? propIds)
        .map((id) => propMap.get(id))
        .filter(Boolean)
        .map((n) => `@${n}`),
    });
    previousShotSummary = memory?.summary;
  }

  return {
    prompt,
    count: 1,
    style: state.projectStyle,
    purpose,
    compose: true,
    shotIndex,
    imageTaskId: task.imageTaskId,
    imageTaskContext: imageTaskToQcContext(task),
    aspectRatio: state.aspectRatio,
    customAspectRatio: state.customAspectRatio,
    clarity: state.clarity,
    customClarityWidth: state.customClarityWidth,
    customClarityHeight: state.customClarityHeight,
    projectBible: state.projectBible,
    worldBible: state.worldBible,
    stylePresetId: state.stylePresetId,
    cameraTemplateId: state.cameraTemplateId,
    consistencySettings: state.consistencySettings,
    consistency,
    previousShotSummary,
  };
}

/** 按 shotIndex 查找 ImageTask 并组装请求（旧入口兼容） */
export function buildShotFrameRequestForShotIndex(
  state: T2VWorkbenchState,
  director: DirectorState,
  shotIndex: number,
  characters: CharacterRef[],
  scenes: SceneRef[],
  props: PropRef[],
  purpose: "final" | "first-frame" = "final"
) {
  const task =
    state.imageTasks?.find((t) => t.sourceShotIndexes.includes(shotIndex)) ??
    undefined;
  if (task) {
    return buildShotFrameRequestFromImageTask(
      state,
      director,
      task,
      characters,
      scenes,
      props,
      purpose
    );
  }
  return buildShotFrameRequest(state, director, shotIndex, characters, scenes, props, purpose);
}
