const VIDEO_CACHE_PREFIX = "workbench-video:";

export function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown, opts?: { stripLargeUrls?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    const payload = opts?.stripLargeUrls ? stripLargeDataUrls(value) : value;
    const raw = JSON.stringify(payload);
    sessionStorage.setItem(key, raw);
    try {
      localStorage.setItem(key, raw);
    } catch {
      localStorage.setItem(key, JSON.stringify(stripLargeDataUrls(value)));
    }
  } catch {
    /* quota */
  }
}

function stripLargeDataUrls(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const clone = structuredClone(value) as Record<string, unknown>;
  const testResult = clone.testResult as Record<string, unknown> | null | undefined;
  if (testResult?.videoUrl && String(testResult.videoUrl).startsWith("data:")) {
    const taskId = String(testResult.taskId ?? "unknown");
    try {
      sessionStorage.setItem(
        `${VIDEO_CACHE_PREFIX}${taskId}`,
        String(testResult.videoUrl)
      );
    } catch {
      testResult.videoUrl = null;
    }
  }
  const imageAsset = clone.imageAsset as Record<string, unknown> | null | undefined;
  if (imageAsset?.previewUrl && String(imageAsset.previewUrl).startsWith("data:")) {
    const id = String(imageAsset.id ?? "img");
    try {
      sessionStorage.setItem(
        `${VIDEO_CACHE_PREFIX}img-${id}`,
        String(imageAsset.previewUrl)
      );
    } catch {
      /* ignore */
    }
  }
  // 批量生成结果：把 data: 视频转存到 sessionStorage，避免撑爆 localStorage
  const batchResults = clone.batchResults as
    | Record<string, Record<string, unknown>>
    | null
    | undefined;
  if (batchResults && typeof batchResults === "object") {
    for (const shot of Object.values(batchResults)) {
      if (shot?.videoUrl && String(shot.videoUrl).startsWith("data:")) {
        const taskId = String(shot.taskId ?? "");
        if (taskId) {
          try {
            sessionStorage.setItem(`${VIDEO_CACHE_PREFIX}${taskId}`, String(shot.videoUrl));
          } catch {
            /* ignore */
          }
        }
        shot.videoUrl = null;
      }
    }
  }
  return clone;
}

export function restoreVideoUrl(taskId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${VIDEO_CACHE_PREFIX}${taskId}`);
}

export function restoreImagePreviewUrl(id: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${VIDEO_CACHE_PREFIX}img-${id}`);
}

export function cacheVideoUrl(taskId: string, url: string): void {
  if (typeof window === "undefined" || !url.startsWith("data:")) return;
  try {
    sessionStorage.setItem(`${VIDEO_CACHE_PREFIX}${taskId}`, url);
  } catch {
    /* ignore */
  }
}
