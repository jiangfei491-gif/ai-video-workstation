import { wrapSubtitleText } from "@/app/lib/auto-edit/engines/subtitle-engine/wrap-text";
import type { SubtitlePlanClip } from "../types";

export type LayoutOptions = {
  maxCharsPerLine?: number;
  maxLines?: number;
  safeMarginV?: number;
};

const DEFAULT_LAYOUT: Required<LayoutOptions> = {
  maxCharsPerLine: 18,
  maxLines: 2,
  safeMarginV: 60,
};

/** Rule Engine：自动断句 / 换行 / 字数限制 */
export function applyLayoutToClips(
  clips: SubtitlePlanClip[],
  options?: LayoutOptions
): SubtitlePlanClip[] {
  const cfg = { ...DEFAULT_LAYOUT, ...options };
  return clips.map((c) => ({
    ...c,
    text: wrapSubtitleText(c.text.trim(), cfg.maxCharsPerLine, cfg.maxLines),
  }));
}

export function estimateReadingCps(text: string, durationSec: number): number {
  if (durationSec <= 0) return 0;
  const chars = text.replace(/\s/g, "").length;
  return chars / durationSec;
}
