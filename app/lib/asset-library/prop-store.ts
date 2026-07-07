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
import type { PropAsset } from "./types";

const PROPS_FILE = "props.json";

function load(): PropAsset[] {
  return readProductionJson<PropAsset[]>(PROPS_FILE, []);
}

function save(items: PropAsset[]): void {
  writeProductionJson(PROPS_FILE, items);
}

export function listProps(): PropAsset[] {
  return load().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getProp(id: string): PropAsset | null {
  return load().find((p) => p.id === id) ?? null;
}

export function createProp(params: {
  name: string;
  description: string;
  category?: string;
  imageBuffer?: Buffer;
}): PropAsset {
  const name = params.name.trim();
  if (!name) throw new Error("道具名不能为空");

  const all = load();
  if (all.some((p) => p.name === name)) {
    throw new Error(`道具名「${name}」已存在`);
  }

  const id = randomUUID();
  let refImageUrl: string | undefined;
  let refImagePath: string | undefined;

  if (params.imageBuffer && params.imageBuffer.length > 0) {
    const filename = `prop-${id.slice(0, 8)}-${Date.now()}.png`;
    const filepath = desktopImagePath(filename);
    fs.writeFileSync(filepath, params.imageBuffer);
    refImagePath = filepath;
    refImageUrl = toDesktopFileUrl(path.join("Images", filename));
  }

  const prop: PropAsset = {
    id,
    name,
    description: params.description.trim(),
    category: (params.category ?? "general").trim(),
    refImageUrl,
    refImagePath,
    createdAt: new Date().toISOString(),
  };

  all.push(prop);
  save(all);
  return prop;
}

export function deleteProp(id: string): boolean {
  const all = load();
  const target = all.find((p) => p.id === id);
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
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
