import type { PacingProfile, TransitionType } from "@/app/lib/auto-edit/types";

/**
 * Director Plan — AI 导演（大脑）的输出。
 * 只描述「用什么、放几秒、什么转场、什么节奏」，不包含 OpenCut 执行细节。
 */
export type DirectorPlan = {
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  fps: number;
  aspectRatio: string;
  pacingProfile: PacingProfile;
  /** 镜头级决策 */
  clips: ClipIntent[];
  voice?: VoiceIntent;
  subtitles: SubtitleIntent[];
  music?: MusicIntent;
  meta: DirectorPlanMeta;
};

export type ClipIntent = {
  id: string;
  shotIndex: number;
  /** 媒体池 / 素材 id */
  assetId: string;
  assetUrl?: string;
  label: string;
  /** 在时间轴上的起始秒（由导演或 Clip Agent 累计） */
  startSec: number;
  durationSec: number;
  transitionAfter?: TransitionIntent;
  rationale?: string;
  tags?: string[];
};

export type TransitionIntent = {
  type: TransitionType;
  durationMs: number;
  rationale?: string;
};

export type VoiceIntent = {
  assetId: string;
  assetUrl?: string;
  volume?: number;
  duckMusic?: boolean;
  rationale?: string;
};

export type SubtitleIntent = {
  id: string;
  text: string;
  startSec: number;
  durationSec: number;
  shotIndex?: number;
  style?: "default" | "emphasis";
};

export type MusicIntent = {
  assetId: string;
  assetUrl?: string;
  startSec?: number;
  durationSec?: number;
  volume?: number;
  rationale?: string;
};

export type DirectorPlanMeta = {
  aiNotes: string[];
  sectionPacing?: Record<string, string>;
  /** 生成 Plan 时对应的分镜内容指纹 */
  storyboardFingerprint?: string;
  model?: string;
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
};
