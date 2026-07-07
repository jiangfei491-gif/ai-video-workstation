import { extractJsonObject } from "./json";
import { getMaterialLockFields } from "../truth-lock";
import { buildMaterialUserPrompt } from "./material-context";
import { pickJudgeProvider, providerChat } from "./providers";
import type { ScriptCandidate, TruthReport } from "./types";
import type { Material } from "../types";

const TRUTH_SYSTEM = `你是事实检查官（Truth Judge），职责是审查脚本相对原始素材是否越界。

重点检查：
1. 是否新增素材中未出现的人物
2. 是否新增未记载的事件、案件结果、警方/官方结论
3. 是否新增或篡改时间、地点
4. 是否虚构证据、采访、数据
5. 是否将推测写成定论（未解之谜类若允许推测须标注）

输出 JSON：
{
  "authenticityScore": 0,
  "violations": [{"segment":"第N段或引用原句","issue":"问题说明"}],
  "summary": "一句话总结"
}

authenticityScore 为 0-100 整数。每发现一处严重违规至少扣 15 分。`;

function clamp(n: unknown): number {
  const v = Math.round(Number(n));
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}

export async function truthJudgeScript(
  material: Material,
  candidate: ScriptCandidate
): Promise<ScriptCandidate> {
  const judge = pickJudgeProvider(candidate.provider);
  const lock = getMaterialLockFields(material);
  const user = `【素材原文】
${buildMaterialUserPrompt(material)}

【锁规则】
contentType: ${lock.contentType}
truthLock: ${lock.truthLock}%
forbidNewCharacters: ${lock.forbidNewCharacters}
forbidNewEvents: ${lock.forbidNewEvents}
forbidChangeEnding: ${lock.forbidChangeEnding}
allowSpeculation: ${lock.allowSpeculation}
allowDialogue: ${lock.allowDialogue}
allowFiction: ${lock.allowFiction}

【待审脚本】
${candidate.script}`;

  const { text } = await providerChat(judge, TRUTH_SYSTEM, user, { json: true, maxTokens: 1200 });
  const raw = extractJsonObject(text);
  const violations = Array.isArray(raw.violations)
    ? raw.violations
        .map((v) => {
          const o = v as Record<string, unknown>;
          return {
            segment: String(o.segment ?? "").trim(),
            issue: String(o.issue ?? "").trim(),
          };
        })
        .filter((v) => v.segment || v.issue)
    : [];

  const truthReport: TruthReport = {
    authenticityScore: clamp(raw.authenticityScore),
    violations,
    summary: String(raw.summary ?? "").trim() || "已完成事实审查",
  };

  const penalty = violations.length * 8;
  const blendedAuth = Math.max(0, truthReport.authenticityScore - penalty);
  const scores = candidate.scores
    ? {
        ...candidate.scores,
        authenticity: Math.round((candidate.scores.authenticity + blendedAuth) / 2),
      }
    : undefined;
  const totalScore = scores
    ? Math.round(
        (scores.authenticity * 0.22 +
          scores.storytelling * 0.14 +
          scores.suspense * 0.14 +
          scores.emotion * 0.12 +
          scores.informationDensity * 0.1 +
          scores.completionRatePredict * 0.12 +
          scores.commentRatePredict * 0.08 +
          scores.shareRatePredict * 0.08)
      )
    : candidate.totalScore;

  if (scores) scores.total = totalScore ?? scores.total;

  return {
    ...candidate,
    truthReport,
    scores,
    totalScore: totalScore ?? candidate.totalScore,
  };
}
