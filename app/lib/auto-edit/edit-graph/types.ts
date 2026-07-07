import type {
  ClipSpec,
  EditPlan,
  EditSequence,
  EditTransition,
  PacingProfile,
  TransitionType,
} from "../types";

/** 时间线上的一个片段 */
export type TimelineClip = {
  id: string;
  track: "video" | "voice" | "music" | "subtitle";
  startSec: number;
  durationSec: number;
  /** video: shot-0；voice/subtitle: narr-0 / script-seg-id */
  sourceKey: string;
  mediaRefId?: string;
  label: string;
  video?: ClipSpec;
  subtitle?: { text: string; style?: "default" | "emphasis" };
  effects?: ClipEffect[];
  audio?: {
    volume: number;
    fadeInMs?: number;
    fadeOutMs?: number;
    duckUnderVoice?: boolean;
  };
};

/** 转场（Render Engine 将消费） */
export type TimelineTransition = {
  id: string;
  afterClipId: string;
  type: TransitionType;
  durationMs: number;
  rationale?: string;
};

/** 镜头级特效（Effect Center 写入） */
export type ClipEffectKind = "zoom" | "blur" | "flash" | "shake" | "motion" | "glow";

export type ClipEffect = {
  kind: ClipEffectKind;
  /** 相对该 clip 起点 */
  startSec: number;
  durationSec: number;
  intensity?: number;
};

export type EditTimeline = {
  fps: number;
  aspectRatio: string;
  durationSec: number;
  video: TimelineClip[];
  voice: TimelineClip[];
  music: TimelineClip[];
  subtitle: TimelineClip[];
  transitions: TimelineTransition[];
};

export type ScriptSegment = {
  id: string;
  text: string;
  shotIndex?: number;
  charStart?: number;
  charEnd?: number;
  timelineStartSec?: number;
  /** storyboard = 分镜旁白；script = 全文拆分；ai = AI 对齐 */
  source?: "storyboard" | "script" | "ai";
};

export type MediaPoolKind =
  | "image"
  | "video"
  | "voice"
  | "music"
  | "subtitle-text";

export type MediaPoolOrigin =
  | "shotFrames"
  | "batchResults"
  | "storyboard"
  | "script"
  | "upload"
  | "tts"
  | "library";

export type MediaPoolItem = {
  id: string;
  kind: MediaPoolKind;
  label: string;
  url?: string;
  shotIndex?: number;
  text?: string;
  origin: MediaPoolOrigin;
  status: "ready" | "missing" | "pending";
};

export type EditPlanRationale = {
  summary: string[];
  perShot: Record<string, string>;
  perTransition: Record<string, string>;
  voiceMatch?: string;
  musicChoice?: string;
  beatSync?: string;
};

export type EditPlanVariant = {
  id: string;
  name: string;
  createdAt: string;
  pacingProfile: PacingProfile;
  timeline: EditTimeline;
  /** 兼容现有 render：由 timeline 派生（含 AI 决策字段） */
  sequence: import("../types").EditPlan;
  rationale: EditPlanRationale;
  model?: string;
  usage?: EditPlan["usage"];
};

/** Edit Graph v2 — 剪辑中心单一真相源 */
export type EditGraph = {
  version: 2;
  timeline: EditTimeline;
  scriptMap: ScriptSegment[];
  mediaPool: MediaPoolItem[];
  plans: EditPlanVariant[];
  activePlanId: string | null;
  pacingProfile: PacingProfile;
  updatedAt: string;
  /** 构建时对应的分镜内容指纹，用于检测编导更新后剪辑过期 */
  storyboardFingerprint?: string;
};
