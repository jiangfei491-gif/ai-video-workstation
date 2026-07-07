import { extractJsonObject } from "./json";
import { buildMaterialUserPrompt } from "./material-context";
import { pickJudgeProvider, providerChat } from "./providers";
import type { DurationPlan } from "./duration-config";
import { buildDurationPromptBlock } from "./duration-config";
import type { OutlineCandidate, ScriptScores } from "./types";
import type { Material } from "../types";

const OUTLINE_SCORE_SYSTEM = `你是视频脚本策划裁判（客观严苛，与生成模型无关）。

对给定「脚本大纲」从 0-100 打分（整数），维度：
- authenticity：是否贴合素材、有无明显捏造倾向
- storytelling：故事结构与章节设计是否完整
- suspense：钩子与悬念设计
- emotion：情绪张力潜力
- informationDensity：信息点分布是否合理
- completionRatePredict：扩写后完播潜力
- commentRatePredict：评论互动潜力
- shareRatePredict：传播潜力

只返回 JSON：
{
  "authenticity": 0,
  "storytelling": 0,
  "suspense": 0,
  "emotion": 0,
  "informationDensity": 0,
  "completionRatePredict": 0,
  "commentRatePredict": 0,
  "shareRatePredict": 0,
  "brief": "一句话点评",
  "deductReasons": "主要扣分点（可空）"
}`;

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function computeTotal(s: Omit<ScriptScores, "total">): number {
  const weights = {
    authenticity: 0.2,
    storytelling: 0.16,
    suspense: 0.16,
    emotion: 0.1,
    informationDensity: 0.1,
    completionRatePredict: 0.12,
    commentRatePredict: 0.08,
    shareRatePredict: 0.08,
  };
  const sum =
    s.authenticity * weights.authenticity +
    s.storytelling * weights.storytelling +
    s.suspense * weights.suspense +
    s.emotion * weights.emotion +
    s.informationDensity * weights.informationDensity +
    s.completionRatePredict * weights.completionRatePredict +
    s.commentRatePredict * weights.commentRatePredict +
    s.shareRatePredict * weights.shareRatePredict;
  return Math.round(sum);
}

function parseScores(raw: Record<string, unknown>): ScriptScores {
  const base = {
    authenticity: clampScore(raw.authenticity),
    storytelling: clampScore(raw.storytelling ?? raw.storying),
    suspense: clampScore(raw.suspense),
    emotion: clampScore(raw.emotion),
    informationDensity: clampScore(raw.informationDensity),
    completionRatePredict: clampScore(raw.completionRatePredict),
    commentRatePredict: clampScore(raw.commentRatePredict),
    shareRatePredict: clampScore(raw.shareRatePredict),
  };
  return { ...base, total: computeTotal(base) };
}

export async function scoreOutlineCandidate(
  material: Material,
  plan: DurationPlan,
  candidate: OutlineCandidate
): Promise<OutlineCandidate> {
  const judge = pickJudgeProvider(candidate.provider);
  const user = `【素材】
${buildMaterialUserPrompt(material)}

【时长目标】
${buildDurationPromptBlock(plan)}

【待评大纲】（生成方：${candidate.provider} / ${candidate.style}）
${candidate.outline}`;

  const { text } = await providerChat(judge, OUTLINE_SCORE_SYSTEM, user, {
    json: true,
    maxTokens: 700,
    phase: "outline-score",
  });
  const raw = extractJsonObject(text);
  const scores = parseScores(raw);

  return {
    ...candidate,
    judgeProvider: judge,
    scores,
    totalScore: scores.total,
    brief: String(raw.brief ?? "").trim() || undefined,
  };
}
