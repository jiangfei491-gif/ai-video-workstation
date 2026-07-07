import type { VoiceCenterProviderId, VoiceDirectorTask } from "./types";
import { createHash } from "crypto";
import { cacheDirFor } from "@/app/lib/storage/workspace-paths";

/** Workspace 缓存目录（进程内 Map；磁盘目录由 WorkspaceManager 管理） */
export const voiceCenterCacheRoot = cacheDirFor("voice-center");

const cache = new Map<string, import("./types").VoiceCenterResult>();

function cacheKey(task: VoiceDirectorTask, provider: VoiceCenterProviderId): string {
  const payload = {
    text: task.text.trim(),
    provider,
    voiceId: task.voiceId,
    speed: task.speed,
    pitch: task.pitch,
    volume: task.volume,
    emotion: task.emotion,
    language: task.language,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getCachedResult(
  task: VoiceDirectorTask,
  provider: VoiceCenterProviderId
): import("./types").VoiceCenterResult | null {
  const hit = cache.get(cacheKey(task, provider));
  if (!hit) return null;
  return { ...hit, cached: true, status: "cached" };
}

export function setCachedResult(
  task: VoiceDirectorTask,
  provider: VoiceCenterProviderId,
  result: import("./types").VoiceCenterResult
) {
  cache.set(cacheKey(task, provider), result);
}

export function clearVoiceCache() {
  cache.clear();
}

export function voiceCacheSize(): number {
  return cache.size;
}
