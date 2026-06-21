import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  desktopImagePath,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { SceneAsset } from "./types";

const SCENES_FILE = "scenes.json";

function load(): SceneAsset[] {
  return readProductionJson<SceneAsset[]>(SCENES_FILE, []);
}
function save(items: SceneAsset[]): void {
  writeProductionJson(SCENES_FILE, items);
}

export function listScenes(): SceneAsset[] {
  return load().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getScene(id: string): SceneAsset | null {
  return load().find((s) => s.id === id) ?? null;
}

export function createScene(params: {
  name: string;
  description: string;
  imageBuffer?: Buffer;
}): SceneAsset {
  const name = params.name.trim();
  if (!name) throw new Error("场景名不能为空");

  const all = load();
  if (all.some((s) => s.name === name)) {
    throw new Error(`场景名「${name}」已存在`);
  }

  const id = randomUUID();
  let refImageUrl: string | undefined;
  let refImagePath: string | undefined;

  if (params.imageBuffer && params.imageBuffer.length > 0) {
    const filename = `scene-${id.slice(0, 8)}-${Date.now()}.png`;
    const filepath = desktopImagePath(filename);
    fs.writeFileSync(filepath, params.imageBuffer);
    refImagePath = filepath;
    refImageUrl = toDesktopFileUrl(path.join("Images", filename));
  }

  const scene: SceneAsset = {
    id,
    name,
    description: params.description.trim(),
    refImageUrl,
    refImagePath,
    createdAt: new Date().toISOString(),
  };

  all.push(scene);
  save(all);
  return scene;
}

export function updateSceneImage(id: string, imageBuffer: Buffer): SceneAsset {
  const all = load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("场景不存在");

  const current = all[idx];
  if (current.refImagePath) {
    try {
      if (fs.existsSync(current.refImagePath)) fs.unlinkSync(current.refImagePath);
    } catch {
      /* ignore */
    }
  }

  const filename = `scene-${id.slice(0, 8)}-${Date.now()}.png`;
  const filepath = desktopImagePath(filename);
  fs.writeFileSync(filepath, imageBuffer);

  const updated: SceneAsset = {
    ...current,
    refImagePath: filepath,
    refImageUrl: toDesktopFileUrl(path.join("Images", filename)),
  };
  all[idx] = updated;
  save(all);
  return updated;
}

export function deleteScene(id: string): boolean {
  const all = load();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  const target = all.find((s) => s.id === id);
  if (target?.refImagePath) {
    try {
      if (fs.existsSync(target.refImagePath)) fs.unlinkSync(target.refImagePath);
    } catch {
      /* ignore */
    }
  }
  save(next);
  return true;
}
