import fs from "fs";
import os from "os";
import path from "path";

import { listImageAssets } from "@/app/lib/asset-library";
import type { ImageAsset } from "@/app/lib/asset-library/types";
import { imageTaskIdFromIndex } from "./shot-id";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export type RestoreFramesResult = {
  patch: Partial<T2VWorkbenchState>;
  matched: number;
  matchedByPrompt: number;
  matchedByOrder: number;
  unmatched: number;
  totalShots: number;
};

function normalizePrompt(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function loadImageAssetsForRestore(): ImageAsset[] {
  const fromWorkspace = listImageAssets();
  if (fromWorkspace.length > 0) return fromWorkspace;

  const candidates = [
    path.join(os.homedir(), "Desktop", "AI-Veo", "storage", "library", "materials", "image-assets.json"),
    path.join(os.homedir(), "Desktop", "AI-Veo", "Projects", "image-assets.json"),
  ];
  for (const fp of candidates) {
    if (!fs.existsSync(fp)) continue;
    try {
      const items = JSON.parse(fs.readFileSync(fp, "utf8")) as ImageAsset[];
      if (Array.isArray(items) && items.length > 0) return items;
    } catch {
      /* try next */
    }
  }
  return [];
}

function buildPromptAssetIndex(): Map<string, { id: string; publicUrl: string; createdAt: string }> {
  const index = new Map<string, { id: string; publicUrl: string; createdAt: string }>();
  for (const asset of loadImageAssetsForRestore()) {
    const key = normalizePrompt(asset.prompt ?? "");
    if (!key) continue;
    const prev = index.get(key);
    if (!prev || new Date(asset.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
      index.set(key, { id: asset.id, publicUrl: asset.publicUrl, createdAt: asset.createdAt });
    }
  }
  return index;
}

function findAssetForPrompt(
  prompt: string,
  index: Map<string, { id: string; publicUrl: string; createdAt: string }>,
  prefixLen = 160
): { id: string; publicUrl: string } | null {
  const normalized = normalizePrompt(prompt);
  if (!normalized) return null;
  const exact = index.get(normalized);
  if (exact) return exact;

  const prefix = normalized.slice(0, prefixLen);
  if (prefix.length < 40) return null;
  for (const [key, asset] of index) {
    if (key.startsWith(prefix) || prefix.startsWith(key.slice(0, prefixLen))) {
      return asset;
    }
  }
  return null;
}

/** 从 image-assets.json 恢复 shotFrames / imageTaskFrames（编导清空后的补救） */
export function restoreShotFramesFromImageAssets(
  state: T2VWorkbenchState,
  opts?: { allowOrderFallback?: boolean }
): RestoreFramesResult {
  const allowOrderFallback = opts?.allowOrderFallback ?? true;
  const prompts = state.director?.prompts ?? [];
  const shotCount = Math.max(prompts.length, state.director?.storyboard?.length ?? 0);
  if (!shotCount) {
    return {
      patch: {},
      matched: 0,
      matchedByPrompt: 0,
      matchedByOrder: 0,
      unmatched: 0,
      totalShots: 0,
    };
  }

  const allAssets = loadImageAssetsForRestore().sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const orderFallbackAssets =
    allAssets.length >= shotCount ? allAssets.slice(allAssets.length - shotCount) : allAssets;

  const index = buildPromptAssetIndex();
  const shotFrames: Record<number, string> = {};
  const shotFrameAssets: Record<number, string> = {};
  const imageTaskFrames: Record<string, string> = {};
  const imageTaskFrameAssets: Record<string, string> = {};

  let matchedByPrompt = 0;
  let matchedByOrder = 0;
  let unmatched = 0;

  const applyAsset = (i: number, asset: { id: string; publicUrl: string }) => {
    shotFrames[i] = asset.publicUrl;
    shotFrameAssets[i] = asset.id;
    const shotId =
      state.director?.storyboard?.[i]?.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`;
    const taskId =
      state.imageTaskMapping?.shotToImageTaskMap?.[shotId] ?? imageTaskIdFromIndex(i);
    imageTaskFrames[taskId] = asset.publicUrl;
    imageTaskFrameAssets[taskId] = asset.id;
  };

  for (let i = 0; i < shotCount; i++) {
    const prompt =
      prompts[i]?.providerPrompt?.trim() ||
      state.imageTasks?.[i]?.providerPrompt?.trim() ||
      "";
    const asset = findAssetForPrompt(prompt, index);
    if (asset) {
      matchedByPrompt++;
      applyAsset(i, asset);
      continue;
    }

    const ordered = orderFallbackAssets[i];
    if (allowOrderFallback && ordered) {
      matchedByOrder++;
      applyAsset(i, ordered);
      continue;
    }

    unmatched++;
  }

  return {
    patch: {
      shotFrames,
      shotFrameAssets,
      imageTaskFrames,
      imageTaskFrameAssets,
      batchRunning: false,
    },
    matched: matchedByPrompt + matchedByOrder,
    matchedByPrompt,
    matchedByOrder,
    unmatched,
    totalShots: shotCount,
  };
}
