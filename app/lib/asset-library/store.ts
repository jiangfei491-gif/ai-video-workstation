import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  desktopImagePath,
  desktopVideoPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { ImageAsset } from "./types";

const IMAGES_FILE = "image-assets.json";

function loadImages(): ImageAsset[] {
  return readProductionJson<ImageAsset[]>(IMAGES_FILE, []);
}

function saveImages(items: ImageAsset[]): void {
  writeProductionJson(IMAGES_FILE, items);
}

export function listImageAssets(): ImageAsset[] {
  return loadImages().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getImageAsset(id: string): ImageAsset | null {
  return loadImages().find((a) => a.id === id) ?? null;
}

export function saveImageAsset(params: {
  prompt: string;
  buffer: Buffer;
  model: string;
  source?: ImageAsset["source"];
  width?: number;
  height?: number;
}): ImageAsset {
  const id = randomUUID();
  const filename = `img-${Date.now()}-${id.slice(0, 8)}.png`;
  const filepath = desktopImagePath(filename);
  fs.writeFileSync(filepath, params.buffer);

  const asset: ImageAsset = {
    id,
    source: params.source ?? "gpt-image-2",
    prompt: params.prompt,
    filepath,
    publicUrl: toDesktopFileUrl(path.join("Images", filename)),
    width: params.width ?? 1024,
    height: params.height ?? 1536,
    model: params.model,
    createdAt: new Date().toISOString(),
  };

  const all = loadImages();
  all.push(asset);
  saveImages(all);
  return asset;
}

export function saveFirstFrameAsset(params: {
  shotId: string;
  sourceClipUrl: string;
  buffer: Buffer;
}): { id: string; publicUrl: string; filepath: string } {
  const id = randomUUID();
  const filename = `ff-${params.shotId.slice(0, 8)}-${Date.now()}.png`;
  const filepath = desktopImagePath(filename);
  fs.writeFileSync(filepath, params.buffer);
  return {
    id,
    filepath,
    publicUrl: toDesktopFileUrl(path.join("Images", filename)),
  };
}

export function saveVideoClipAsset(params: {
  shotId: string;
  mode: "test" | "production";
  buffer: Buffer;
  taskId: string;
  durationSec: number;
}): { id: string; publicUrl: string; filepath: string } {
  ensureDesktopVeoLayout();
  const id = randomUUID();
  const prefix = params.mode === "test" ? "test" : "prod";
  const filename = `${prefix}-${params.shotId.slice(0, 8)}-${Date.now()}.mp4`;
  const filepath = desktopVideoPath(filename);
  fs.writeFileSync(filepath, params.buffer);

  return {
    id,
    filepath,
    publicUrl: toDesktopFileUrl(path.join("Videos", filename)),
  };
}

export function readImageBuffer(assetId: string): Buffer {
  const asset = getImageAsset(assetId);
  if (!asset) throw new Error(`图片资产不存在: ${assetId}`);
  return fs.readFileSync(asset.filepath);
}
