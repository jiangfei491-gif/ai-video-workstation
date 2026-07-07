import type { QaDirectorTask } from "./types";

export type QaCenterUiSettings = {
  optimizeWithAi: boolean;
  scoreThreshold: number;
  probeExportedVideo: boolean;
};

const STORAGE_KEY = "qa-center:ui-settings";

export const DEFAULT_QA_CENTER_UI: QaCenterUiSettings = {
  optimizeWithAi: true,
  scoreThreshold: 75,
  probeExportedVideo: true,
};

export function loadQaCenterUiSettings(): QaCenterUiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_QA_CENTER_UI };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QA_CENTER_UI };
    return { ...DEFAULT_QA_CENTER_UI, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_QA_CENTER_UI };
  }
}

export function saveQaCenterUiSettings(settings: QaCenterUiSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export type { QaDirectorTask };
