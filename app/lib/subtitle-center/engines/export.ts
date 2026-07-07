import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { SubtitleEngineOptions } from "@/app/lib/auto-edit/engines/types";
import { buildSrtContent } from "@/app/lib/auto-edit/engines/subtitle-engine/build-srt";
import { buildAssContent } from "@/app/lib/auto-edit/engines/subtitle-engine/build-ass";
import type { SubtitleCenterExports } from "../types";
import { resolveAssTemplateId } from "./style";
import type { SubtitleStyleTemplate } from "../types";

function srtTimeToVtt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

function buildWebVtt(clips: TimelineClip[]): string {
  const lines = ["WEBVTT", ""];
  for (const c of clips) {
    const text = c.subtitle?.text?.trim();
    if (!text) continue;
    lines.push(
      `${srtTimeToVtt(c.startSec)} --> ${srtTimeToVtt(c.startSec + c.durationSec)}`,
      text,
      ""
    );
  }
  return lines.join("\n");
}

function buildJsonExport(clips: TimelineClip[], style: SubtitleStyleTemplate, animation: string) {
  return JSON.stringify(
    {
      version: 1,
      style,
      animation,
      clips: clips.map((c) => ({
        id: c.id,
        text: c.subtitle?.text ?? "",
        startSec: c.startSec,
        endSec: c.startSec + c.durationSec,
      })),
    },
    null,
    2
  );
}

/** Export Engine：SRT / ASS / WebVTT / JSON */
export function buildSubtitleExports(params: {
  clips: TimelineClip[];
  style?: SubtitleStyleTemplate;
  animation?: string;
  playRes?: { w: number; h: number };
  engineOptions?: SubtitleEngineOptions;
}): SubtitleCenterExports {
  const style = params.style ?? "default";
  const assTemplate = resolveAssTemplateId(style);
  const options: SubtitleEngineOptions = {
    templateId: assTemplate,
    ...params.engineOptions,
  };
  const playRes = params.playRes ?? { w: 1080, h: 1920 };

  return {
    srt: buildSrtContent(params.clips, options),
    ass: buildAssContent(params.clips, playRes, options),
    webvtt: buildWebVtt(params.clips),
    json: buildJsonExport(params.clips, style, params.animation ?? "fade"),
  };
}
