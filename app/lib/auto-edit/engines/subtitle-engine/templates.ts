import type { SubtitleTemplateId, SubtitleLanguage } from "../types";
import { fontProfileFor } from "../localization";

export type AssStyleDef = {
  name: string;
  fontname: string;
  fontsize: number;
  primary: string;
  outline: number;
  shadow: number;
  alignment: number;
  marginV: number;
};

const TEMPLATES: Record<SubtitleTemplateId, AssStyleDef> = {
  default: {
    name: "Default",
    fontname: "PingFang SC",
    fontsize: 42,
    primary: "&H00FFFFFF",
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginV: 60,
  },
  documentary: {
    name: "Default",
    fontname: "PingFang SC",
    fontsize: 38,
    primary: "&H00F0F0F0",
    outline: 2,
    shadow: 0,
    alignment: 2,
    marginV: 72,
  },
  viral: {
    name: "Default",
    fontname: "PingFang SC Semibold",
    fontsize: 48,
    primary: "&H00FFFFFF",
    outline: 3,
    shadow: 2,
    alignment: 2,
    marginV: 48,
  },
  cinematic: {
    name: "Default",
    fontname: "PingFang SC",
    fontsize: 36,
    primary: "&H00E8E8E8",
    outline: 1,
    shadow: 1,
    alignment: 2,
    marginV: 80,
  },
  bilingual: {
    name: "Default",
    fontname: "PingFang SC",
    fontsize: 40,
    primary: "&H00FFFFFF",
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginV: 64,
  },
};

export const SUBTITLE_TEMPLATES: { id: SubtitleTemplateId; label: string }[] = [
  { id: "default", label: "默认" },
  { id: "documentary", label: "纪录片" },
  { id: "viral", label: "短视频" },
  { id: "cinematic", label: "电影感" },
  { id: "bilingual", label: "双语" },
];

export function getAssStyle(templateId: SubtitleTemplateId = "default"): AssStyleDef {
  return TEMPLATES[templateId] ?? TEMPLATES.default;
}

export function buildAssStylesHeader(
  playRes: { w: number; h: number },
  templateId: SubtitleTemplateId = "default",
  primaryLang?: SubtitleLanguage
): string {
  const s = getAssStyle(templateId);
  const profile = primaryLang ? fontProfileFor(primaryLang) : null;
  const fontname = profile?.fontname ?? s.fontname;
  const fontsize = profile?.fontsize ?? s.fontsize;
  const marginV = profile?.marginV ?? s.marginV;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${playRes.w}
PlayResY: ${playRes.h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${s.name},${fontname},${fontsize},${s.primary},&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,${s.outline},${s.shadow},${s.alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}
