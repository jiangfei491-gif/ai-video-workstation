import type { SubtitleCenterLanguage, SubtitleStyleTemplate, SubtitleAnimationId } from "./types";

export type SubtitleCenterUiSettings = {
  language: SubtitleCenterLanguage;
  styleTemplate: SubtitleStyleTemplate;
  animation: SubtitleAnimationId;
  optimizeWithAi: boolean;
  maxCharsPerLine: number;
  maxLines: number;
};

const STORAGE_KEY = "subtitle-center:ui-settings";

export const DEFAULT_SUBTITLE_CENTER_UI: SubtitleCenterUiSettings = {
  language: "zh",
  styleTemplate: "tiktok",
  animation: "fade",
  optimizeWithAi: true,
  maxCharsPerLine: 18,
  maxLines: 2,
};

export function loadSubtitleCenterUiSettings(): SubtitleCenterUiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SUBTITLE_CENTER_UI };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SUBTITLE_CENTER_UI };
    return { ...DEFAULT_SUBTITLE_CENTER_UI, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SUBTITLE_CENTER_UI };
  }
}

export function saveSubtitleCenterUiSettings(settings: SubtitleCenterUiSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
