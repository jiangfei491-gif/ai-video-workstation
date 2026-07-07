import type { VoiceCategory } from "./types";

export type VoiceLibraryEntry = {
  id: string;
  label: string;
  category: VoiceCategory;
  provider: import("./types").VoiceCenterProviderId;
  language?: string;
  previewText?: string;
};

/** 音色库（分类浏览 / 收藏 / 试听 — 第一版静态目录） */
export const VOICE_LIBRARY: VoiceLibraryEntry[] = [
  { id: "zh-CN-XiaoxiaoNeural", label: "晓晓（女·旁白）", category: "female", provider: "f5-tts", language: "zh" },
  { id: "zh-CN-YunxiNeural", label: "云希（男·旁白）", category: "male", provider: "f5-tts", language: "zh" },
  { id: "zh-CN-YunyangNeural", label: "云扬（男·新闻）", category: "news", provider: "f5-tts", language: "zh" },
  { id: "zh-CN-XiaoyiNeural", label: "晓伊（童声）", category: "child", provider: "f5-tts", language: "zh" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel（英·电影）", category: "film", provider: "elevenlabs", language: "en" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam（英·纪录片）", category: "documentary", provider: "elevenlabs", language: "en" },
  { id: "alloy", label: "Alloy（OpenAI）", category: "narrator", provider: "openai-audio", language: "en" },
];

export function searchVoiceLibrary(q: string, category?: VoiceCategory): VoiceLibraryEntry[] {
  const needle = q.trim().toLowerCase();
  return VOICE_LIBRARY.filter((v) => {
    if (category && v.category !== category) return false;
    if (!needle) return true;
    return v.label.toLowerCase().includes(needle) || v.id.toLowerCase().includes(needle);
  });
}

export const VOICE_CATEGORY_LABEL: Record<VoiceCategory, string> = {
  male: "男",
  female: "女",
  child: "儿童",
  elder: "老人",
  narrator: "旁白",
  news: "新闻",
  film: "电影",
  documentary: "纪录片",
  anime: "动漫",
  host: "主播",
};
