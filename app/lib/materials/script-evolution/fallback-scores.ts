import type { ScriptCandidate, ScriptScores } from "./types";

export function fallbackScores(reason = "裁判暂不可用"): ScriptScores {
  return {
    authenticity: 55,
    storytelling: 55,
    suspense: 55,
    emotion: 55,
    informationDensity: 55,
    completionRatePredict: 55,
    commentRatePredict: 55,
    shareRatePredict: 55,
    total: 55,
  };
}

export function withFallbackScores(
  candidate: ScriptCandidate,
  reason?: string
): ScriptCandidate {
  const scores = fallbackScores(reason);
  return { ...candidate, scores, totalScore: scores.total };
}
