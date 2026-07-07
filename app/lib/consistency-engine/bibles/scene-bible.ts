import { getScene } from "@/app/lib/asset-library/scene-store";
import type { SceneAsset } from "@/app/lib/asset-library/types";
import type { ComposeSectionBlock } from "../types/compose";

function traitLines(s: SceneAsset): string[] {
  const lines: string[] = [];
  if (s.description.trim()) lines.push(s.description.trim());
  if (s.timeOfDay?.trim()) lines.push(`Time: ${s.timeOfDay.trim()}`);
  if (s.weather?.trim()) lines.push(`Weather: ${s.weather.trim()}`);
  if (s.mainLightSource?.trim()) lines.push(`Light source: ${s.mainLightSource.trim()}`);
  if (s.cameraLanguage?.trim()) lines.push(`Scene camera language: ${s.cameraLanguage.trim()}`);
  if (s.backgroundElements?.trim()) lines.push(`Background: ${s.backgroundElements.trim()}`);
  if (s.forbiddenChanges?.trim()) lines.push(`FORBIDDEN changes: ${s.forbiddenChanges.trim()}`);
  return lines;
}

export function renderSceneBible(sceneId?: string): ComposeSectionBlock | null {
  if (!sceneId) return null;
  const s = getScene(sceneId);
  if (!s) return null;
  const lines = traitLines(s);
  if (lines.length === 0) return null;
  return {
    section: "scene_bible",
    title: `SCENE BIBLE — @${s.name}`,
    lines: [`Use @${s.name} only. Do not rewrite the full environment each shot.`, ...lines],
  };
}

export function sceneToken(sceneId?: string): string | null {
  if (!sceneId) return null;
  const s = getScene(sceneId);
  return s?.name ? `@${s.name}` : null;
}

/** @deprecated */
export function buildSceneLockBlock(sceneId?: string) {
  const block = renderSceneBible(sceneId);
  if (!block) return null;
  const name = block.title.replace("SCENE BIBLE — ", "");
  return { token: name, lines: block.lines };
}
