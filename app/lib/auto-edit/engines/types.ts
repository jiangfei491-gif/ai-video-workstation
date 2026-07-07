import type { TimelineClip, EditTimeline } from "../edit-graph/types";

/** 引擎阶段（与产品路线图对齐） */
export type EnginePhase = 1 | 2 | 3 | 4 | 5;

export type SubtitleTemplateId =
  | "default"
  | "documentary"
  | "viral"
  | "cinematic"
  | "bilingual";

export type SubtitleLanguage = "zh" | "en" | "vi" | "ja" | "ko";

export type SubtitleEngineOptions = {
  templateId?: SubtitleTemplateId;
  /** 主语言字幕轨 */
  primaryLang?: SubtitleLanguage;
  /** 副语言（双语模式） */
  secondaryLang?: SubtitleLanguage;
  secondaryTexts?: Record<string, string>;
  maxCharsPerLine?: number;
  maxLines?: number;
  highlightKeywords?: string[];
  /** 烧录 ASS（默认 true）；false 则仅导出 SRT */
  burnAss?: boolean;
};

export type VoiceProviderId =
  | "edge-tts"
  | "openai-audio"
  | "elevenlabs"
  | "google-tts"
  | "azure-tts"
  | "local";

export type VoiceEngineOptions = {
  provider?: VoiceProviderId;
  voiceId?: string;
  /** 输出 voice.wav / mp3 并写入 mediaPool */
  syncToTimeline?: boolean;
};

export type MusicEngineOptions = {
  bgmPath?: string | null;
  volume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  loop?: boolean;
  duckUnderVoice?: boolean;
  duckAmount?: number;
  totalDurationSec: number;
};

export type ExtendedTransitionType =
  | "cut"
  | "crossfade"
  | "dip_black"
  | "slide_left"
  | "slide_right"
  | "slide_up"
  | "slide_down"
  | "zoom_in"
  | "blur"
  | "flash"
  | "wipe_left"
  | "wipe_right"
  | "push_left"
  | "push_right";

export type RenderEngineContext = {
  timeline: EditTimeline;
  mediaPool: import("../edit-graph/types").MediaPoolItem[];
  outputSize: { w: number; h: number };
  fps: number;
  subtitle?: SubtitleEngineOptions;
  voice?: VoiceEngineOptions;
  music?: MusicEngineOptions;
};

export type SubtitleBuildInput = {
  clips: TimelineClip[];
  playRes: { w: number; h: number };
  options?: SubtitleEngineOptions;
};

export type ShotDecision = {
  shotIndex: number;
  key: string;
  label: string;
  durationSec: number;
  suggestedDurationSec?: number;
  reason: string;
  tags?: string[];
};
