/**
 * AI Cut 特效中心（Effect Center）
 *
 * DeepSeek Effect Agent 负责分析推荐；Effect Center 负责时间轴执行与 OpenCut 交付。
 */

import type {
  ClipEffect,
  TimelineClip,
  TimelineTransition,
} from "@/app/lib/auto-edit/edit-graph/types";
import type { PacingProfile, TransitionType } from "@/app/lib/auto-edit/types";

export type { ClipEffect, ClipEffectKind } from "@/app/lib/auto-edit/edit-graph/types";

export type EffectPresetId = "documentary" | "viral" | "cinematic" | "minimal" | "dynamic";

export type TransitionRecommendation = {
  afterClipId: string;
  type: TransitionType;
  durationMs: number;
  rationale: string;
};

export type ClipEffectRecommendation = ClipEffect & {
  clipId: string;
  rationale: string;
};

/** 导演下发的特效任务 */
export type EffectDirectorTask = {
  id: string;
  durationSec: number;
  pacingProfile?: PacingProfile;
  topic?: string;
  script?: string;
  optimizeWithAi?: boolean;
  preset?: EffectPresetId;
  defaultTransition?: TransitionType;
  defaultTransitionMs?: number;
  videoClips: {
    id: string;
    label: string;
    startSec: number;
    durationSec: number;
    shotIndex?: number;
  }[];
  subtitleHints?: { text: string; startSec: number; endSec: number }[];
  voiceHints?: { startSec: number; endSec: number }[];
};

/** DeepSeek Effect Agent 输出 */
export type EffectPlan = {
  preset: EffectPresetId;
  rationale: string[];
  transitions: TransitionRecommendation[];
  clipEffects: ClipEffectRecommendation[];
};

export type EffectCenterExports = {
  json: string;
};

export type OpenCutEffectPayload = {
  transitions: TimelineTransition[];
  effectHints: ClipEffectRecommendation[];
  commands: import("@/app/lib/opencut/commands").OpenCutCommand[];
};

export type EffectCenterResult = {
  taskId: string;
  status: "success" | "failed";
  transitions: TimelineTransition[];
  video: TimelineClip[];
  plan?: EffectPlan;
  exports: EffectCenterExports;
  openCut: OpenCutEffectPayload;
  cost?: number;
  error?: string;
};

export type EffectCenterLogEntry = {
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed";
  transitionCount?: number;
  effectCount?: number;
  cost?: number;
  error?: string;
};
