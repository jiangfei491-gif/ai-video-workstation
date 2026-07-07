/**
 * AI Cut 字幕中心（Subtitle Center）
 *
 * DeepSeek 负责智能优化；Rule Engine 负责格式/时间轴/导出。
 * 不参与剪辑与渲染，最终交付 OpenCut。
 */

import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { SubtitleEngineOptions, SubtitleLanguage } from "@/app/lib/auto-edit/engines/types";

export type SubtitleCenterLanguage = SubtitleLanguage | "es" | "fr" | "de" | "ru";

export type SubtitleStyleTemplate =
  | "tiktok"
  | "capcut"
  | "youtube-shorts"
  | "instagram-reels"
  | "movie"
  | "documentary"
  | "news"
  | "education"
  | "commerce"
  | "gaming"
  | "podcast"
  | "vlog"
  | "custom"
  | "default";

export type SubtitleAnimationId =
  | "fade"
  | "typewriter"
  | "word-by-word"
  | "karaoke"
  | "bounce"
  | "scale"
  | "slide"
  | "highlight"
  | "none";

export type SentenceTimestamp = {
  text: string;
  startSec: number;
  endSec: number;
};

export type WordTimestamp = {
  word: string;
  startSec: number;
  endSec: number;
};

/** 导演 / 配音中心下发的字幕任务 */
export type SubtitleDirectorTask = {
  id: string;
  script?: string;
  language?: SubtitleCenterLanguage;
  styleTemplate?: SubtitleStyleTemplate;
  animation?: SubtitleAnimationId;
  sentenceTimestamp?: SentenceTimestamp[];
  wordTimestamp?: WordTimestamp[];
  /** 启用 DeepSeek 智能优化 */
  optimizeWithAi?: boolean;
  translateTo?: SubtitleCenterLanguage[];
  maxCharsPerLine?: number;
  maxLines?: number;
  highlightKeywords?: string[];
  playRes?: { w: number; h: number };
  engineOptions?: SubtitleEngineOptions;
};

export type SubtitlePlanClip = {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
  highlightWords?: string[];
  animation?: SubtitleAnimationId;
  style?: SubtitleStyleTemplate;
};

/** DeepSeek Agent 输出 */
export type SubtitlePlan = {
  clips: SubtitlePlanClip[];
  styleRecommendation?: SubtitleStyleTemplate;
  animationRecommendation?: SubtitleAnimationId;
  summary?: string[];
  qaHints?: string[];
};

export type QaIssue = {
  code: string;
  message: string;
  clipId?: string;
  severity: "error" | "warning";
  autoFixed?: boolean;
};

export type SubtitleCenterExports = {
  srt: string;
  ass: string;
  webvtt: string;
  json: string;
};

export type OpenCutSubtitlePayload = {
  subtitleTracks: {
    id: string;
    startSec: number;
    durationSec: number;
    text: string;
    style?: string;
    animation?: string;
  }[];
  commands: import("@/app/lib/opencut/commands").OpenCutCommand[];
};

export type SubtitleCenterResult = {
  taskId: string;
  status: "success" | "failed" | "cached";
  subtitle: TimelineClip[];
  exports: SubtitleCenterExports;
  openCut: OpenCutSubtitlePayload;
  language: SubtitleCenterLanguage;
  style: SubtitleStyleTemplate;
  animation: SubtitleAnimationId;
  plan?: SubtitlePlan;
  qa: QaIssue[];
  cost?: number;
  cached?: boolean;
  error?: string;
};

export type SubtitleCenterLogEntry = {
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "cached";
  clipCount?: number;
  cost?: number;
  error?: string;
};
