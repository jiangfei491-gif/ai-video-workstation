import type { ClipSourceKind, EditRenderMode, EditSequence } from "../types";
import type { EditTimeline, MediaPoolItem } from "../edit-graph/types";
import type { EditEngineSettings } from "../engines/edit-settings";
import type { ShotMotionSpec } from "./shot-motion-resolver";

export type EffectiveClipKind = "image" | "video" | "skip";

export type TimelineSegment = {
  key: string;
  shotIndex: number;
  label: string;
  /** 时间轴上的起始时间（秒） */
  startSec: number;
  durationSec: number;
  effectiveKind: EffectiveClipKind;
  sourceKind: ClipSourceKind;
  inputPath: string | null;
  skipReason?: string;
  /**
   * 由 ShotMotionResolver 从 Narrative Shot 镜头语言解析（Phase 1）。
   * null / undefined = 无镜头语言 → 图片段回退旧固定 zoompan。
   */
  motionSpec?: ShotMotionSpec | null;
};

export type RenderTimeline = {
  segments: TimelineSegment[];
  totalDurationSec: number;
  outputSize: { w: number; h: number };
  fps: number;
  skippedKeys: string[];
};

export type AssetValidationIssue = {
  key: string;
  shotIndex: number;
  reason: string;
};

export type AssetValidationResult = {
  /** 至少有一个可渲染片段 */
  canRender: boolean;
  readyCount: number;
  issues: AssetValidationIssue[];
  warnings: string[];
};

/** 单条 FFmpeg 调用（底层 runner 只负责执行 args） */
export type FfmpegCommand = {
  id: string;
  label: string;
  args: string[];
  outputPath: string;
};

export type RenderPlan = {
  sequence: EditSequence;
  mode: EditRenderMode;
  validation: AssetValidationResult;
  timeline: RenderTimeline;
  segmentCommands: FfmpegCommand[];
  concatListPath: string;
  concatCommand: FfmpegCommand;
  outputPath: string;
  outputFileName: string;
  tmpDir: string;
};

export type RenderEngineParams = {
  sequence: EditSequence;
  editTimeline?: EditTimeline;
  mediaPool?: MediaPoolItem[];
  aspectRatio: string;
  fps: number;
  mode: EditRenderMode;
  bgmUrl?: string | null;
  bgmVolume?: number;
  voiceId?: string;
  voiceProvider?: import("../engines/types").VoiceProviderId;
  /** Render Engine 统一配置 */
  engineSettings?: EditEngineSettings;
  /** 渲染前自动 TTS，默认 true */
  synthesizeVoice?: boolean;
  onProgress?: (pct: number, msg: string) => void;
};

export type RenderEngineResult = {
  outputUrl: string;
  filepath: string;
  skippedKeys: string[];
  plan: RenderPlan;
};
