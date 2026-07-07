import fs from "fs";
import { getCharacter } from "@/app/lib/asset-library/character-store";
import { getProp } from "@/app/lib/asset-library/prop-store";
import { getScene } from "@/app/lib/asset-library/scene-store";

export type ReferenceBundle = {
  paths: string[];
  labels: string[];
};

/** Phase 3 — 收集角色/场景/道具参考图本地路径（优先级：角色 > 场景 > 道具） */
export function collectReferencePaths(params: {
  characterIds: string[];
  sceneId?: string;
  propIds: string[];
  maxRefs?: number;
}): ReferenceBundle {
  const max = params.maxRefs ?? 3;
  const paths: string[] = [];
  const labels: string[] = [];

  function push(path: string | undefined, label: string) {
    if (!path || paths.length >= max) return;
    if (!fs.existsSync(path)) return;
    paths.push(path);
    labels.push(label);
  }

  for (const id of params.characterIds) {
    const c = getCharacter(id);
    push(c?.refImagePath, `character:${c?.name ?? id}`);
  }
  if (params.sceneId) {
    const s = getScene(params.sceneId);
    push(s?.refImagePath, `scene:${s?.name ?? params.sceneId}`);
  }
  for (const id of params.propIds) {
    const p = getProp(id);
    push(p?.refImagePath, `prop:${p?.name ?? id}`);
  }

  return { paths, labels };
}
