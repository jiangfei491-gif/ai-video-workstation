import type { TransitionType } from "@/app/lib/auto-edit/types";
import type { EffectPresetId } from "./types";

export type EffectCenterUiSettings = {
  preset: EffectPresetId;
  optimizeWithAi: boolean;
  defaultTransition: TransitionType;
  defaultTransitionMs: number;
};

const STORAGE_KEY = "effect-center:ui-settings";

export const DEFAULT_EFFECT_CENTER_UI: EffectCenterUiSettings = {
  preset: "documentary",
  optimizeWithAi: true,
  defaultTransition: "crossfade",
  defaultTransitionMs: 400,
};

export function loadEffectCenterUiSettings(): EffectCenterUiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_EFFECT_CENTER_UI };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EFFECT_CENTER_UI };
    return { ...DEFAULT_EFFECT_CENTER_UI, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_EFFECT_CENTER_UI };
  }
}

export function saveEffectCenterUiSettings(settings: EffectCenterUiSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
