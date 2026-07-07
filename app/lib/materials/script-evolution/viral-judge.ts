import { extractJsonObject } from "./json";
import { pickJudgeProvider, providerChat } from "./providers";
import type { ScriptCandidate, ViralReport } from "./types";

const VIRAL_SYSTEM = `你是爆款预测官，专门评估短视频口播脚本的传播潜力。

分析：
1. 前三秒是否抓人（hookStrength 0-100）
2. 前十秒是否有悬念（suspenseAt10s 0-100）
3. 是否每 30 秒左右有新信息点（infoEvery30s 0-100）
4. 结尾是否促进评论（commentTrigger 0-100）
5. 综合预估完播率 completionRatePredict（0-100）

只返回 JSON：
{
  "completionRatePredict": 0,
  "hookStrength": 0,
  "suspenseAt10s": 0,
  "infoEvery30s": 0,
  "commentTrigger": 0,
  "summary": "一句话预测"
}`;

function clamp(n: unknown): number {
  const v = Math.round(Number(n));
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}

export async function viralJudgeScript(candidate: ScriptCandidate): Promise<ScriptCandidate> {
  const judge = pickJudgeProvider(candidate.provider);
  const { text } = await providerChat(
    judge,
    VIRAL_SYSTEM,
    `【脚本】\n${candidate.script}`,
    { json: true, maxTokens: 600 }
  );
  const raw = extractJsonObject(text);
  const viralReport: ViralReport = {
    completionRatePredict: clamp(raw.completionRatePredict),
    hookStrength: clamp(raw.hookStrength),
    suspenseAt10s: clamp(raw.suspenseAt10s),
    infoEvery30s: clamp(raw.infoEvery30s),
    commentTrigger: clamp(raw.commentTrigger),
    summary: String(raw.summary ?? "").trim() || "已完成爆款预测",
  };

  const scores = candidate.scores
    ? {
        ...candidate.scores,
        completionRatePredict: Math.round(
          (candidate.scores.completionRatePredict + viralReport.completionRatePredict) / 2
        ),
        commentRatePredict: Math.round(
          (candidate.scores.commentRatePredict + viralReport.commentTrigger) / 2
        ),
      }
    : undefined;

  if (scores) {
    scores.total = Math.round(
      scores.authenticity * 0.22 +
        scores.storytelling * 0.14 +
        scores.suspense * 0.14 +
        scores.emotion * 0.12 +
        scores.informationDensity * 0.1 +
        scores.completionRatePredict * 0.12 +
        scores.commentRatePredict * 0.08 +
        scores.shareRatePredict * 0.08
    );
  }

  return {
    ...candidate,
    viralReport,
    scores,
    totalScore: scores?.total ?? candidate.totalScore,
  };
}
