import { extractJsonObject } from "./json";
import { getMaterialLockFields } from "../truth-lock";
import { buildMaterialUserPrompt } from "./material-context";
import type { DurationPlan } from "./duration-config";
import { buildDurationPromptBlock } from "./duration-config";
import { listAvailableProviders, providerChat } from "./providers";
import type {
  FullScriptScores,
  JudgeScoreEntry,
  ScriptCandidate,
  ScriptProviderId,
} from "./types";
import type { Material } from "../types";

const FULL_SCORE_SYSTEM = `你是视频长脚本裁判（必须与生成模型无关，客观严苛）。

对给定完整口播脚本从 0-100 打分（整数），维度：
- hookStrength：黄金3秒/开头钩子
- storytelling：故事结构
- suspense：悬念节奏
- pacing：节奏把控
- emotion：情绪感染力
- characterDepth：人物塑造
- informationDensity：信息密度
- authenticity：事实与素材一致性
- logic：逻辑连贯
- originality：原创度
- aiTaste：AI 味（越高越自然、越低越机械）
- durationFit：时长匹配度（字数与结构是否达标）
- completionRatePredict：完播率预测
- ctrPredict：点击率/标题吸引力预测
- commentRatePredict：评论率预测
- shareRatePredict：分享率预测

只返回 JSON：
{
  "hookStrength": 0,
  "storytelling": 0,
  "suspense": 0,
  "pacing": 0,
  "emotion": 0,
  "characterDepth": 0,
  "informationDensity": 0,
  "authenticity": 0,
  "logic": 0,
  "originality": 0,
  "aiTaste": 0,
  "durationFit": 0,
  "completionRatePredict": 0,
  "ctrPredict": 0,
  "commentRatePredict": 0,
  "shareRatePredict": 0,
  "brief": "一句话总评",
  "deductReasons": "主要扣分点"
}`;

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function computeFullTotal(s: Omit<FullScriptScores, "total">): number {
  const weights: Record<keyof Omit<FullScriptScores, "total">, number> = {
    hookStrength: 0.1,
    storytelling: 0.1,
    suspense: 0.08,
    pacing: 0.08,
    emotion: 0.07,
    characterDepth: 0.05,
    informationDensity: 0.06,
    authenticity: 0.12,
    logic: 0.06,
    originality: 0.04,
    aiTaste: 0.04,
    durationFit: 0.08,
    completionRatePredict: 0.06,
    ctrPredict: 0.03,
    commentRatePredict: 0.04,
    shareRatePredict: 0.03,
  };
  let sum = 0;
  for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
    sum += s[key] * weights[key];
  }
  return Math.round(sum);
}

function parseFullScores(raw: Record<string, unknown>): FullScriptScores {
  const base = {
    hookStrength: clampScore(raw.hookStrength),
    storytelling: clampScore(raw.storytelling ?? raw.storying),
    suspense: clampScore(raw.suspense),
    pacing: clampScore(raw.pacing),
    emotion: clampScore(raw.emotion),
    characterDepth: clampScore(raw.characterDepth),
    informationDensity: clampScore(raw.informationDensity),
    authenticity: clampScore(raw.authenticity),
    logic: clampScore(raw.logic),
    originality: clampScore(raw.originality),
    aiTaste: clampScore(raw.aiTaste),
    durationFit: clampScore(raw.durationFit),
    completionRatePredict: clampScore(raw.completionRatePredict),
    ctrPredict: clampScore(raw.ctrPredict),
    commentRatePredict: clampScore(raw.commentRatePredict),
    shareRatePredict: clampScore(raw.shareRatePredict),
  };
  return { ...base, total: computeFullTotal(base) };
}

async function scoreByJudge(
  material: Material,
  plan: DurationPlan,
  candidate: ScriptCandidate,
  judge: ScriptProviderId
): Promise<JudgeScoreEntry> {
  const lock = getMaterialLockFields(material);
  const user = `【素材】
${buildMaterialUserPrompt(material)}

【时长目标】
${buildDurationPromptBlock(plan)}

【入库锁】内容类型 ${lock.contentType}，真实性锁 ${lock.truthLock}%

【待评长脚本】（生成方：${candidate.provider} / ${candidate.style}）
${candidate.script}`;

  const { text } = await providerChat(judge, FULL_SCORE_SYSTEM, user, {
    json: true,
    maxTokens: 900,
    phase: "final-score",
  });
  const raw = extractJsonObject(text);
  const scores = parseFullScores(raw);
  return {
    judgeProvider: judge,
    scores,
    total: scores.total,
    brief: String(raw.brief ?? "").trim(),
    deductReasons: String(raw.deductReasons ?? "").trim() || undefined,
  };
}

export async function scoreFinalScriptWithAllJudges(
  material: Material,
  plan: DurationPlan,
  candidate: ScriptCandidate
): Promise<ScriptCandidate> {
  const judges = listAvailableProviders();
  const judgeScores: JudgeScoreEntry[] = [];

  for (const judge of judges) {
    try {
      judgeScores.push(await scoreByJudge(material, plan, candidate, judge));
    } catch (err) {
      console.error(`[script-evolution] 长文评分失败 ${judge}`, err);
    }
  }

  if (judgeScores.length === 0) {
    throw new Error("长文评分全部失败");
  }

  const aggregatedScore = Math.round(
    judgeScores.reduce((s, j) => s + j.total, 0) / judgeScores.length
  );

  const avgScores = judgeScores[0].scores;
  return {
    ...candidate,
    judgeScores,
    aggregatedScore,
    totalScore: aggregatedScore,
    scores: {
      authenticity: avgScores.authenticity,
      storytelling: avgScores.storytelling,
      suspense: avgScores.suspense,
      emotion: avgScores.emotion,
      informationDensity: avgScores.informationDensity,
      completionRatePredict: avgScores.completionRatePredict,
      commentRatePredict: avgScores.commentRatePredict,
      shareRatePredict: avgScores.shareRatePredict,
      total: aggregatedScore,
    },
  };
}
