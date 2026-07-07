import type { VoiceCenterProviderId, VoiceQualityHint } from "./types";

export type VoiceCenterUiSettings = {
  voiceId: string;
  /** 未指定则走默认本地链 */
  provider?: VoiceCenterProviderId;
  ultraQuality: boolean;
  quality: VoiceQualityHint;
  speed: number;
};

const STORAGE_KEY = "voice-center:ui-settings";

export const DEFAULT_VOICE_CENTER_UI: VoiceCenterUiSettings = {
  voiceId: "zh-CN-XiaoxiaoNeural",
  provider: undefined,
  ultraQuality: false,
  quality: "standard",
  speed: 1,
};

export function loadVoiceCenterUiSettings(): VoiceCenterUiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_CENTER_UI };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_CENTER_UI };
    return { ...DEFAULT_VOICE_CENTER_UI, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_VOICE_CENTER_UI };
  }
}

export function saveVoiceCenterUiSettings(settings: VoiceCenterUiSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
