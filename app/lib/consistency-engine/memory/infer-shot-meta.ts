import { getCharacter } from "@/app/lib/asset-library/character-store";
import { getProp } from "@/app/lib/asset-library/prop-store";
import { getScene } from "@/app/lib/asset-library/scene-store";
import type { DirectorStoryboardShot } from "@/app/lib/director/types";
import type { ShotConsistencyMeta } from "../types/shot";

function matchCharacterIds(
  shot: DirectorStoryboardShot,
  projectCharacterIds: string[]
): string[] {
  const text = `${shot.character} ${shot.action} ${shot.narration}`.toLowerCase();
  const matched: string[] = [];
  for (const id of projectCharacterIds) {
    const c = getCharacter(id);
    if (!c) continue;
    if (text.includes(c.name.toLowerCase())) matched.push(id);
  }
  return matched.length > 0 ? matched : projectCharacterIds.slice(0, 1);
}

function matchSceneId(
  shot: DirectorStoryboardShot,
  projectSceneIds: string[]
): string | undefined {
  const text = `${shot.environment} ${shot.action}`.toLowerCase();
  for (const id of projectSceneIds) {
    const s = getScene(id);
    if (!s) continue;
    if (text.includes(s.name.toLowerCase())) return id;
  }
  return projectSceneIds[0];
}

function matchPropIds(
  shot: DirectorStoryboardShot,
  projectPropIds: string[]
): string[] {
  const text = `${shot.action} ${shot.environment} ${shot.narration}`.toLowerCase();
  const matched: string[] = [];
  for (const id of projectPropIds) {
    const p = getProp(id);
    if (!p) continue;
    if (text.includes(p.name.toLowerCase())) matched.push(id);
  }
  return matched;
}

/** 编导完成后为每镜推断 Bible 引用 + 继承 + Delta */
export function inferShotConsistencyMeta(
  storyboard: DirectorStoryboardShot[],
  projectCharacterIds: string[],
  projectSceneIds: string[],
  projectPropIds: string[] = []
): ShotConsistencyMeta[] {
  return storyboard.map((shot, index) => ({
    characterIds: matchCharacterIds(shot, projectCharacterIds),
    sceneId: matchSceneId(shot, projectSceneIds),
    propIds: matchPropIds(shot, projectPropIds),
    inheritFrom: index === 0 ? null : index - 1,
    deltaAction: shot.action.trim(),
    deltaCamera: shot.camera.trim(),
    lighting: index === 0 ? "establish scene lighting" : "same as previous",
  }));
}
