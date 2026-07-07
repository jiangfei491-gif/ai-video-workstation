import { extractJsonObject } from "./json";
import { getMaterialLockFields } from "../truth-lock";
import { buildMaterialUserPrompt } from "./material-context";
import { pickJudgeProvider, providerChat } from "./providers";
import type { ScriptCandidate, ScriptScores } from "./types";
import type { Material } from "../types";

const SCORE_SYSTEM = `你是短视频脚本裁判（必须与生成模型无关，客观严苛）。

对给定脚本从 0-100 打分（整数），维度：
- authenticity：是否符合素材事实、有无捏造
- storytelling：叙事结构是否完整流畅
- suspense：悬念与钩子强度
- emotion：情绪感染力
- informationDensity：信息密度与节奏
- completionRatePredict：预估完播率潜力
- commentRatePredict：预估评论互动潜力
- shareRatePredict：预估分享传播潜力

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
  "brief": "一句话点评"
}`;

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function computeTotal(s: Omit<ScriptScores, "total">): number {
  const weights = {
    authenticity: 0.22,
    storytelling: 0.14,
    suspense: 0.14,
    emotion: 0.12,
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

export async function scoreScriptCandidate(
  material: Material,
  candidate: ScriptCandidate
): Promise<ScriptCandidate> {
  const judge = pickJudgeProvider(candidate.provider);
  const lock = getMaterialLockFields(material);
  const user = `【素材】
${buildMaterialUserPrompt(material)}

【入库锁】内容类型 ${lock.contentType}，真实性锁 ${lock.truthLock}%
禁止新增人物：${lock.forbidNewCharacters}
禁止新增事件：${lock.forbidNewEvents}
禁止改变结局：${lock.forbidChangeEnding}

【待评脚本】（生成方：${candidate.provider} / ${candidate.style}）
${candidate.script}`;

  const { text } = await providerChat(judge, SCORE_SYSTEM, user, { json: true, maxTokens: 800 });
  const raw = extractJsonObject(text);
  const scores = parseScores(raw);

  return {
    ...candidate,
    judgeProvider: judge,
    scores,
    totalScore: scores.total,
  };
}
