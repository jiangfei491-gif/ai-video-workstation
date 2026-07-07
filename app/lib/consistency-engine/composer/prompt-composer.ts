import { expandAllRefsFromStore } from "@/app/lib/asset-library/expand-refs";
import { renderCameraBible } from "../engines/camera-engine";
import { renderStyleBible } from "../engines/style-engine";
import { renderWorldBible } from "../engines/world-engine";
import { renderCharacterBible } from "../bibles/character-bible";
import { renderProjectBible } from "../bibles/project-bible";
import { renderPropBible } from "../bibles/prop-bible";
import { renderSceneBible } from "../bibles/scene-bible";
import { renderConstraints, renderShotDelta, renderShotMemory } from "./sections";
import type { ComposeInput, ComposeResult } from "../types/compose";

export const PROMPT_FORMULA =
  "Project + Style + World + Camera + Character + Scene + Prop + Shot Memory + Delta = Final Prompt";

export function composeFinalPrompt(input: ComposeInput): ComposeResult {
  const styleBlock = input.stylePresetId
    ? renderStyleBible(input.stylePresetId)
    : null;
  const worldBlock = input.worldBible ? renderWorldBible(input.worldBible) : null;
  const cameraBlock = renderCameraBible(input.cameraTemplateId ?? "medium_shot");

  const sections = [
    renderProjectBible(input.projectBible, input.aspectRatio, input.projectStyle),
    ...(styleBlock ? [styleBlock] : []),
    ...(worldBlock ? [worldBlock] : []),
    cameraBlock,
    ...renderCharacterBible(input.characterIds),
    ...(renderSceneBible(input.sceneId) ? [renderSceneBible(input.sceneId)!] : []),
    ...renderPropBible(input.propIds),
    ...(input.shotMemory ? [renderShotMemory(input.shotMemory, input.shotIndex)] : []),
    renderShotDelta(input.shotDelta, input.shotIndex),
    renderConstraints(),
  ];

  const raw = sections
    .map((s) => [`[${s.title}]`, ...s.lines].join("\n"))
    .join("\n\n");

  return {
    finalPrompt: expandAllRefsFromStore(raw),
    sections,
    formula: PROMPT_FORMULA,
  };
}

/** @deprecated 兼容 V1 API */
export function composeShotPrompt(input: {
  deltaPrompt: string;
  bible: ComposeInput["projectBible"];
  aspectRatio: ComposeInput["aspectRatio"];
  projectStyle?: string;
  previousShotSummary?: string;
  shotIndex: number;
  meta?: {
    characterIds?: string[];
    sceneId?: string;
    propIds?: string[];
    inheritFrom?: number | null;
    deltaAction?: string;
    deltaCamera?: string;
    lighting?: string;
  };
}): string {
  const meta = input.meta;
  const result = composeFinalPrompt({
    projectBible: input.bible,
    aspectRatio: input.aspectRatio,
    projectStyle: input.projectStyle,
    characterIds: meta?.characterIds ?? [],
    sceneId: meta?.sceneId,
    propIds: meta?.propIds ?? [],
    shotMemory:
      input.previousShotSummary?.trim() && meta?.inheritFrom != null && meta.inheritFrom >= 0
        ? {
            inheritFrom: meta.inheritFrom,
            summary: input.previousShotSummary,
            locked: {
              characterIds: meta.characterIds ?? [],
              sceneId: meta.sceneId,
              propIds: meta.propIds ?? [],
            },
          }
        : undefined,
    shotDelta: {
      action: meta?.deltaAction ?? "",
      camera: meta?.deltaCamera ?? "",
      lighting: meta?.lighting ?? "same as previous",
      extraPrompt: input.deltaPrompt,
    },
    shotIndex: input.shotIndex,
  });
  return result.finalPrompt;
}
