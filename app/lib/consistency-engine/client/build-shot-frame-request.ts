import type { DirectorState, T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { buildShotMemory } from "../memory/shot-memory";
import type { ShotConsistencyMeta } from "../types/shot";

type CharacterRef = { id: string; name: string };
type SceneRef = { id: string; name: string };
type PropRef = { id: string; name: string };

/** 客户端组装 shot-frame 请求体（Final Prompt 在服务端 Pipeline 生成） */
export function buildShotFrameRequest(
  state: T2VWorkbenchState,
  director: DirectorState,
  shotIndex: number,
  characters: CharacterRef[],
  scenes: SceneRef[],
  props: PropRef[],
  purpose: "final" | "first-frame" = "final"
) {
  const prompt = director.prompts[shotIndex]?.providerPrompt ?? "";
  const meta = director.prompts[shotIndex]?.consistency;
  const charMap = new Map(characters.map((c) => [c.id, c.name]));
  const sceneMap = new Map(scenes.map((s) => [s.id, s.name]));
  const propMap = new Map(props.map((p) => [p.id, p.name]));

  const characterIds = meta?.characterIds ?? state.characterIds.slice(0, 1);
  const sceneId = meta?.sceneId ?? state.sceneIds[0];
  const propIds = meta?.propIds ?? state.propIds ?? [];
  const inheritFrom = meta?.inheritFrom ?? (shotIndex === 0 ? null : shotIndex - 1);

  const consistency: ShotConsistencyMeta = meta ?? {
    characterIds,
    sceneId,
    propIds,
    inheritFrom,
    deltaAction: director.storyboard[shotIndex]?.action ?? "",
    deltaCamera: director.storyboard[shotIndex]?.camera ?? "",
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
