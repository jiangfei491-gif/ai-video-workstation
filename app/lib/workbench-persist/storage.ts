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
