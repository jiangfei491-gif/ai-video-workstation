import { createHash } from "crypto";
import { cacheDirFor } from "@/app/lib/storage/workspace-paths";
import type { SubtitleCenterResult, SubtitleDirectorTask } from "./types";

/** Workspace 缓存目录 */
export const subtitleCenterCacheRoot = cacheDirFor("subtitle-center");

const cache = new Map<string, SubtitleCenterResult>();

function cacheKey(task: SubtitleDirectorTask): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        script: task.script,
        sentences: task.sentenceTimestamp,
        words: task.wordTimestamp,
        lang: task.language,
        style: task.styleTemplate,
        optimize: task.optimizeWithAi,
      })
    )
    .digest("hex");
}

export function getCachedSubtitleResult(task: SubtitleDirectorTask): SubtitleCenterResult | null {
  const hit = cache.get(cacheKey(task));
  if (!hit) return null;
  return { ...hit, cached: true, status: "cached" };
}

export function setCachedSubtitleResult(task: SubtitleDirectorTask, result: SubtitleCenterResult) {
  cache.set(cacheKey(task), result);
}

export function clearSubtitleCache() {
  cache.clear();
}
