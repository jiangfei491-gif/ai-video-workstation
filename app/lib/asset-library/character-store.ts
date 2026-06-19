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
import type { CharacterAsset } from "./types";

const CHARACTERS_FILE = "characters.json";

function load(): CharacterAsset[] {
  return readProductionJson<CharacterAsset[]>(CHARACTERS_FILE, []);
}

function save(items: CharacterAsset[]): void {
  writeProductionJson(CHARACTERS_FILE, items);
}

export function listCharacters(): CharacterAsset[] {
  return load().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getCharacter(id: string): CharacterAsset | null {
  return load().find((c) => c.id === id) ?? null;
}

/** 名字唯一（@引用按名字匹配），创建时去重 */
export function createCharacter(params: {
  name: string;
  appearance: string;
  /** 参考图二进制（可选） */
  imageBuffer?: Buffer;
}): CharacterAsset {
  const name = params.name.trim();
  if (!name) throw new Error("角色名不能为空");

  const all = load();
  if (all.some((c) => c.name === name)) {
    throw new Error(`角色名「${name}」已存在`);
  }

  const id = randomUUID();
  let refImageUrl: string | undefined;
  let refImagePath: string | undefined;

  if (params.imageBuffer && params.imageBuffer.length > 0) {
    const filename = `char-${id.slice(0, 8)}-${Date.now()}.png`;
    const filepath = desktopImagePath(filename);
    fs.writeFileSync(filepath, params.imageBuffer);
    refImagePath = filepath;
    refImageUrl = toDesktopFileUrl(path.join("Images", filename));
  }

  const character: CharacterAsset = {
    id,
    name,
    appearance: params.appearance.trim(),
    refImageUrl,
    refImagePath,
    createdAt: new Date().toISOString(),
  };

  all.push(character);
  save(all);
  return character;
}

export function deleteCharacter(id: string): boolean {
  const all = load();
  const next = all.filter((c) => c.id !== id);
  if (next.length === all.length) return false;
  // 删除关联参考图文件
  const target = all.find((c) => c.id === id);
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
