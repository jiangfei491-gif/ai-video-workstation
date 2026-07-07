import type { QaIssue, QaScoreBreakdown } from "../types";
import { buildRetryTargets } from "../retry-routing";

/** 由 Rule/FFmpeg 问题扣分，得到 rules 分项 */
export function scoreFromIssues(issues: QaIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.category === "deepseek") continue;
    if (issue.severity === "error") score -= 12;
    else if (issue.severity === "warning") score -= 5;
    else score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}

/** 合并 Rule 分与 DeepSeek 各维度分 */
export function mergeQaScores(
  ruleScore: number,
  ai?: Partial<QaScoreBreakdown>
): QaScoreBreakdown {
  const rhythm = ai?.rhythm ?? ruleScore;
  const shots = ai?.shots ?? ruleScore;
  const subtitles = ai?.subtitles ?? ruleScore;
  const music = ai?.music ?? ruleScore;
  const effects = ai?.effects ?? ruleScore;
  const aiOverall = ai?.overall;
  const overall =
    aiOverall != null
      ? Math.round(ruleScore * 0.45 + aiOverall * 0.55)
      : ruleScore;
  return {
    overall: Math.max(0, Math.min(100, overall)),
    rules: ruleScore,
    rhythm,
    shots,
    subtitles,
    music,
    effects,
  };
}

export function buildRetryHint(
  score: QaScoreBreakdown,
  threshold: number,
  issues: QaIssue[],
  suggestions: string[]
): import("../types").QaDirectorRetryHint {
  const belowThreshold = score.overall < threshold;
  const retryTargets = belowThreshold ? buildRetryTargets(issues, score, threshold) : [];
  const focusAreas = retryTargets.map((t) => t.label);

  return {
    belowThreshold,
    shouldRetry: belowThreshold,
    reason: belowThreshold
      ? `Quality Score ${score.overall} 低于参考线 ${threshold} — 请确认是否同意自动定点修复`
      : `Quality Score ${score.overall} 达到参考线 ${threshold}`,
    focusAreas: focusAreas.length > 0 ? focusAreas : suggestions.slice(0, 3),
    retryTargets,
    requiresUserApproval: true,
  };
}

export function summarizeForAi(summary: import("../types").TimelineQaSummary): Record<string, unknown> {
  return {
    videoCount: summary.videoCount,
    voiceCount: summary.voiceCount,
    musicCount: summary.musicCount,
    subtitleCount: summary.subtitleCount,
    transitionCount: summary.transitionCount,
    effectCount: summary.effectCount,
    avgShotSec:
      summary.videoClips.length > 0
        ? summary.videoClips.reduce((s, c) => s + c.durationSec, 0) / summary.videoClips.length
        : 0,
    shots: summary.videoClips.map((c) => ({
      id: c.id,
      label: c.label,
      durationSec: c.durationSec,
      hasMedia: c.hasMedia,
    })),
    subtitlesSample: summary.subtitleClips.slice(0, 12).map((s) => ({
      text: s.text.slice(0, 40),
      startSec: s.startSec,
      endSec: s.endSec,
    })),
    transitions: summary.transitions,
  };
}
