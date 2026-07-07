import type { MusicStyleTemplate } from "./types";

export type MusicCenterUiSettings = {
  styleTemplate: MusicStyleTemplate;
  optimizeWithAi: boolean;
  baseVolume: number;
  duckUnderVoice: boolean;
  duckAmount: number;
  fadeInSec: number;
  fadeOutSec: number;
  beatSync: boolean;
  bpm: number;
  selectedBgmFilename: string;
};

const STORAGE_KEY = "music-center:ui-settings";

export const DEFAULT_MUSIC_CENTER_UI: MusicCenterUiSettings = {
  styleTemplate: "documentary",
  optimizeWithAi: true,
  baseVolume: 0.25,
  duckUnderVoice: true,
  duckAmount: 0.12,
  fadeInSec: 1.5,
  fadeOutSec: 2,
  beatSync: false,
  bpm: 120,
  selectedBgmFilename: "",
};

export function loadMusicCenterUiSettings(): MusicCenterUiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_MUSIC_CENTER_UI };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MUSIC_CENTER_UI };
    return { ...DEFAULT_MUSIC_CENTER_UI, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MUSIC_CENTER_UI };
  }
}

export function saveMusicCenterUiSettings(settings: MusicCenterUiSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
