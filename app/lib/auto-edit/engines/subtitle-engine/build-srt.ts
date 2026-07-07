import type { TimelineClip } from "../../edit-graph/types";
import { wrapSubtitleText } from "./wrap-text";
import type { SubtitleEngineOptions } from "../types";

function srtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** 从字幕轨生成 SRT */
export function buildSrtContent(
  subtitleClips: TimelineClip[],
  options?: SubtitleEngineOptions
): string {
  const maxChars = options?.maxCharsPerLine ?? 18;
  const maxLines = options?.maxLines ?? 2;
  const blocks: string[] = [];
  let idx = 1;

  for (const c of subtitleClips) {
    const text = c.subtitle?.text?.trim();
    if (!text) continue;

    const primary = wrapSubtitleText(text, maxChars, maxLines);
    const secondaryId = c.id;
    const secondary = options?.secondaryTexts?.[secondaryId];
    const body =
      options?.templateId === "bilingual" && secondary ?
        `${primary}\n${wrapSubtitleText(secondary, maxChars, maxLines)}`
      : primary;

    blocks.push(
      `${idx++}\n${srtTime(c.startSec)} --> ${srtTime(c.startSec + c.durationSec)}\n${body}\n`
    );
  }

  return blocks.join("\n");
}
