import type { BuildEditInput } from "../types";
import type { MediaPoolItem } from "./types";
import { clipLabel } from "../keys";
import { buildShotNarrationMap } from "../audio/align-voice-subtitle";

/** 从工作台字段生成素材池（引用，非副本） */
export function buildMediaPool(input: BuildEditInput): MediaPoolItem[] {
  const items: MediaPoolItem[] = [];
  const narrationMap = buildShotNarrationMap(input);

  for (const sb of input.storyboard) {
    const i = sb.shotIndex;
    const batch = input.batchResults[i];
    const frame = input.shotFrames[i];

    if (batch?.status === "success" && batch.videoUrl) {
      items.push({
        id: `video-shot-${i}`,
        kind: "video",
        label: clipLabel(i, sb.action),
        url: batch.videoUrl,
        shotIndex: i,
        origin: "batchResults",
        status: "ready",
      });
    } else if (frame) {
      items.push({
        id: `image-shot-${i}`,
        kind: "image",
        label: clipLabel(i, sb.action),
        url: frame,
        shotIndex: i,
        origin: "shotFrames",
        status: "ready",
      });
    } else if (batch?.firstFrameUrl) {
      items.push({
        id: `image-shot-${i}`,
        kind: "image",
        label: clipLabel(i, sb.action),
        url: batch.firstFrameUrl,
        shotIndex: i,
        origin: "batchResults",
        status: "ready",
      });
    } else {
      items.push({
        id: `missing-shot-${i}`,
        kind: "image",
        label: clipLabel(i, sb.action),
        shotIndex: i,
        origin: "shotFrames",
        status: "missing",
      });
    }

    // Phase 2B：只有真实旁白才建 voice/字幕文本轨；无旁白镜头不生成合成语音（不用视觉描述冒充）
    const narrationText = (narrationMap.get(i) ?? "").trim();
    if (narrationText) {
      items.push({
        id: `voice-script-${i}`,
        kind: "voice",
        label: `口播 · 镜 ${i + 1}`,
        text: narrationText,
        shotIndex: i,
        origin: "storyboard",
        status: "pending",
      });
      items.push({
        id: `sub-text-${i}`,
        kind: "subtitle-text",
        label: `字幕 · 镜 ${i + 1}`,
        text: narrationText,
        shotIndex: i,
        origin: "storyboard",
        status: "ready",
      });
    }
  }

  if ((input.script ?? "").trim()) {
    items.push({
      id: "script-full",
      kind: "subtitle-text",
      label: "完整脚本",
      text: input.script!.trim(),
      origin: "script",
      status: "ready",
    });
  }

  return items;
}

/** 刷新素材池时保留已合成配音、BGM 等本地资源 */
export function mergeMediaPool(
  fresh: MediaPoolItem[],
  existing: MediaPoolItem[]
): MediaPoolItem[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const freshIds = new Set(fresh.map((p) => p.id));

  const merged = fresh.map((item) => {
    const prev = byId.get(item.id);
    if (!prev) return item;
    if (prev.kind === "voice" && prev.status === "ready" && prev.url) {
      return { ...item, url: prev.url, status: "ready" as const };
    }
    if (prev.kind === "music" && prev.url) {
      return { ...item, url: prev.url, status: prev.status };
    }
    if (
      prev.status === "ready" &&
      prev.url &&
      item.kind !== "subtitle-text" &&
      item.kind !== "voice"
    ) {
      return { ...item, url: prev.url, status: "ready" as const };
    }
    return item;
  });

  for (const prev of existing) {
    if (!freshIds.has(prev.id) && (prev.kind === "music" || prev.id === "bgm-main")) {
      merged.push(prev);
    }
  }

  return merged;
}
