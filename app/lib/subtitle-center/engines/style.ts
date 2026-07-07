import type { SubtitleStyleTemplate } from "../types";
import type { SubtitleTemplateId } from "@/app/lib/auto-edit/engines/types";
import { SUBTITLE_TEMPLATES } from "@/app/lib/auto-edit/engines/subtitle-engine/templates";

/** PRD 风格模板 → 现有 ASS 模板映射 */
const STYLE_TO_ASS: Record<SubtitleStyleTemplate, SubtitleTemplateId> = {
  tiktok: "viral",
  capcut: "viral",
  "youtube-shorts": "viral",
  "instagram-reels": "viral",
  movie: "cinematic",
  documentary: "documentary",
  news: "documentary",
  education: "default",
  commerce: "viral",
  gaming: "viral",
  podcast: "default",
  vlog: "default",
  custom: "default",
  default: "default",
};

export const SUBTITLE_STYLE_LABEL: Record<SubtitleStyleTemplate, string> = {
  tiktok: "TikTok",
  capcut: "CapCut",
  "youtube-shorts": "YouTube Shorts",
  "instagram-reels": "Instagram Reels",
  movie: "电影",
  documentary: "纪录片",
  news: "新闻",
  education: "教育",
  commerce: "电商",
  gaming: "游戏",
  podcast: "播客",
  vlog: "Vlog",
  custom: "自定义",
  default: "默认",
};

export function resolveAssTemplateId(style: SubtitleStyleTemplate = "default"): SubtitleTemplateId {
  return STYLE_TO_ASS[style] ?? "default";
}

export function listStyleTemplates(): { id: SubtitleStyleTemplate; label: string; assId: SubtitleTemplateId }[] {
  const ids = Object.keys(SUBTITLE_STYLE_LABEL) as SubtitleStyleTemplate[];
  return ids.map((id) => ({
    id,
    label: SUBTITLE_STYLE_LABEL[id],
    assId: resolveAssTemplateId(id),
  }));
}

export { SUBTITLE_TEMPLATES };
