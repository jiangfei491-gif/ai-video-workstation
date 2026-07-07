/**
 * AI Cut 质检中心（QA Center）
 *
 * OpenCut 成片 / 时间线 → Rule Engine + FFmpeg 探测 + DeepSeek QA Agent → 评分与报告
 * 低于参考线时给出环节建议；是否回炉由用户拍板，不自动执行。
 */

import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { PacingProfile } from "@/app/lib/auto-edit/types";

export type QaIssueSeverity = "error" | "warning" | "info";

export type QaIssueCategory = "rule" | "ffmpeg" | "opencv" | "deepseek";

export type QaIssue = {
  code: string;
  category: QaIssueCategory;
  message: string;
  clipId?: string;
  shotIndex?: number;
  severity: QaIssueSeverity;
};

export type QaScoreBreakdown = {
  /** 0–100 综合分 */
  overall: number;
  rules: number;
  rhythm?: number;
  shots?: number;
  subtitles?: number;
  music?: number;
  effects?: number;
};

export type QaDirectorTask = {
  id: string;
  durationSec: number;
  aspectRatio?: string;
  pacingProfile?: PacingProfile;
  script?: string;
  optimizeWithAi?: boolean;
    /** 参考合格线（仅提示，不自动回流），默认 75 */
  scoreThreshold?: number;
  /** 已导出成片本地路径（可选） */
  exportedVideoPath?: string | null;
  /** 时间线快照摘要（由 workbench 构建） */
  timelineSummary?: TimelineQaSummary;
};

export type TimelineQaSummary = {
  videoCount: number;
  voiceCount: number;
  musicCount: number;
  subtitleCount: number;
  transitionCount: number;
  effectCount: number;
  videoClips: {
    id: string;
    label: string;
    startSec: number;
    durationSec: number;
    shotIndex?: number;
    hasMedia: boolean;
  }[];
  subtitleClips: {
    id: string;
    text: string;
    startSec: number;
    endSec: number;
  }[];
  transitions: { afterClipId: string; type: string; durationMs: number }[];
};

/** DeepSeek QA Agent 输出 */
export type QaAiAssessment = {
  score: QaScoreBreakdown;
  suggestions: string[];
  summary: string[];
};

export type QaCenterReport = {
  json: string;
  markdown: string;
};

export type QaRetryTarget = {
  module: import("@/app/lib/platform/module-registry").ModuleId;
  label: string;
  href: string;
  action: string;
  reason: string;
  /** 是否可由系统自动执行（无需您手动去各中心操作） */
  autoFixable: boolean;
};

export type QaAutoFixStep = {
  target: QaRetryTarget;
  status: "success" | "failed" | "skipped";
  message: string;
};

export type QaAutoFixResult = {
  taskId: string;
  status: "success" | "partial" | "failed" | "declined";
  steps: QaAutoFixStep[];
  editGraph?: import("@/app/lib/auto-edit/edit-graph/types").EditGraph;
  error?: string;
};

export type QaLiveLogLevel = "info" | "ok" | "warn" | "error";

/** 自检实时日志（UI 日志窗口） */
export type QaLiveLogEntry = {
  taskId: string;
  at: string;
  stage: string;
  level: QaLiveLogLevel;
  message: string;
  detail?: string;
};

export type QaDirectorRetryHint = {
  /** 低于参考分数线（仅提示） */
  belowThreshold: boolean;
  /** 兼容旧字段：等同 belowThreshold */
  shouldRetry: boolean;
  reason: string;
  focusAreas: string[];
  /** 建议定点回流的环节 — 必须用户拍板，不自动执行 */
  retryTargets: QaRetryTarget[];
  requiresUserApproval: true;
};

export type QaCenterResult = {
  taskId: string;
  status: "success" | "failed";
  score: QaScoreBreakdown;
  issues: QaIssue[];
  suggestions: string[];
  aiAssessment?: QaAiAssessment;
  retry: QaDirectorRetryHint;
  report: QaCenterReport;
  liveLog: QaLiveLogEntry[];
  cost?: number;
  error?: string;
};

export type QaCenterLogEntry = {
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed";
  overallScore?: number;
  issueCount?: number;
  cost?: number;
  error?: string;
};

/** 从 EditGraph 构建 QA 摘要 */
export function buildTimelineQaSummary(graph: EditGraph): TimelineQaSummary {
  const { timeline, mediaPool } = graph;
  const poolReady = new Set(
    mediaPool.filter((p) => p.status === "ready" && p.url).map((p) => p.id)
  );

  return {
    videoCount: timeline.video.length,
    voiceCount: timeline.voice.length,
    musicCount: timeline.music.length,
    subtitleCount: timeline.subtitle.length,
    transitionCount: timeline.transitions.length,
    effectCount: timeline.video.reduce((n, c) => n + (c.effects?.length ?? 0), 0),
    videoClips: timeline.video.map((c) => ({
      id: c.id,
      label: c.label,
      startSec: c.startSec,
      durationSec: c.durationSec,
      shotIndex: c.video?.shotIndex,
      hasMedia: Boolean(c.mediaRefId && poolReady.has(c.mediaRefId)),
    })),
    subtitleClips: timeline.subtitle.map((c) => ({
      id: c.id,
      text: c.subtitle?.text ?? "",
      startSec: c.startSec,
      endSec: c.startSec + c.durationSec,
    })),
    transitions: timeline.transitions.map((t) => ({
      afterClipId: t.afterClipId,
      type: t.type,
      durationMs: t.durationMs,
    })),
  };
}
