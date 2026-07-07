import type { TimelineClip } from "../../edit-graph/types";
import type { SubtitleEngineOptions } from "../types";
import { buildAssStylesHeader } from "./templates";
import { wrapSubtitleText } from "./wrap-text";
import { highlightKeywordsAss } from "./highlight-keywords";

function assTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Subtitle Engine：ASS 烧录内容（FFmpeg ass 滤镜） */
export function buildAssContent(
  subtitleClips: TimelineClip[],
  playRes: { w: number; h: number },
  options?: SubtitleEngineOptions
): string {
  const templateId = options?.templateId ?? "default";
  const maxChars = options?.maxCharsPerLine ?? 18;
  const maxLines = options?.maxLines ?? 2;
  const keywords = options?.highlightKeywords ?? [];

  const header = buildAssStylesHeader(playRes, templateId, options?.primaryLang);

  const lines = subtitleClips
    .filter((c) => c.subtitle?.text?.trim())
    .map((c) => {
      const start = assTime(c.startSec);
      const end = assTime(c.startSec + c.durationSec);
      let text = wrapSubtitleText(c.subtitle!.text, maxChars, maxLines);

      const secondary = options?.secondaryTexts?.[c.id];
      if (templateId === "bilingual" && secondary) {
        text = `${text}\n${wrapSubtitleText(secondary, maxChars, maxLines)}`;
      }

      if (c.subtitle?.style === "emphasis") {
        text = `{\\b1}${text}{\\r}`;
      }

      text = highlightKeywordsAss(text, keywords);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });

  return header + lines.join("\n") + "\n";
}
