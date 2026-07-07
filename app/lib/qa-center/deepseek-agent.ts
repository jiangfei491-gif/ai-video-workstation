import OpenAI from "openai";
import type { QaAiAssessment, QaDirectorTask, QaIssue, TimelineQaSummary } from "./types";
import { scoreFromIssues, summarizeForAi } from "./engines/score";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function isDeepSeekAvailable(): boolean {
  return Boolean(readEnv("DEEPSEEK_API_KEY"));
}

function fallbackAssessment(
  issues: QaIssue[],
  ruleScore: number
): QaAiAssessment {
  const suggestions: string[] = [];
  for (const issue of issues.filter((i) => i.severity !== "info").slice(0, 8)) {
    suggestions.push(issue.message);
  }
  if (suggestions.length === 0) {
    suggestions.push("时间线结构正常，可进入导出");
  }
  return {
    score: {
      overall: ruleScore,
      rules: ruleScore,
      rhythm: ruleScore,
      shots: ruleScore,
      subtitles: ruleScore,
      music: ruleScore,
      effects: ruleScore,
    },
    suggestions,
    summary: [`规则引擎评分 ${ruleScore}（未启用 DeepSeek）`],
  };
}

/**
 * DeepSeek QA Agent — 分析节奏/镜头/字幕/音乐/特效，给出评分与建议
 */
export async function runDeepSeekQaAssessment(
  task: QaDirectorTask,
  summary: TimelineQaSummary,
  issues: QaIssue[]
): Promise<{ assessment: QaAiAssessment; cost: number }> {
  const ruleScore = scoreFromIssues(issues);
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return { assessment: fallbackAssessment(issues, ruleScore), cost: 0 };
  }

  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

  const payload = {
    durationSec: task.durationSec,
    aspectRatio: task.aspectRatio,
    pacingProfile: task.pacingProfile,
    scriptExcerpt: (task.script ?? "").slice(0, 1500),
    timeline: summarizeForAi(summary),
    ruleIssues: issues.map((i) => ({
      code: i.code,
      message: i.message,
      severity: i.severity,
    })),
  };

  const system = `你是 AI Cut 质检中心 DeepSeek QA Agent。只输出 JSON，不要 markdown。
分析节奏、镜头、字幕、音乐、特效，给出 0–100 分项评分与可执行建议。
输出格式：
{
  "overall": 93,
  "rhythm": 90,
  "shots": 88,
  "subtitles": 95,
  "music": 92,
  "effects": 90,
  "suggestions": ["第3镜头太长", "字幕第8句过长", "建议增加一个转场"],
  "summary": ["整体评价"]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { assessment: fallbackAssessment(issues, ruleScore), cost: 0 };
  }

  const clamp = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  };

  const assessment: QaAiAssessment = {
    score: {
      overall: clamp(parsed.overall, ruleScore),
      rules: ruleScore,
      rhythm: clamp(parsed.rhythm, ruleScore),
      shots: clamp(parsed.shots, ruleScore),
      subtitles: clamp(parsed.subtitles, ruleScore),
      music: clamp(parsed.music, ruleScore),
      effects: clamp(parsed.effects, ruleScore),
    },
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map(String).slice(0, 12)
      : [],
    summary: Array.isArray(parsed.summary) ? parsed.summary.map(String) : ["DeepSeek 质检完成"],
  };

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const cost = (inputTokens * 0.28 + outputTokens * 0.42) / 1_000_000;

  return { assessment, cost };
}
