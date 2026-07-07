import OpenAI from "openai";
import type { SubtitlePlan, SubtitlePlanClip, SubtitleDirectorTask } from "./types";
import { recordTokenCost } from "@/app/lib/cost-ledger/unified";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function isDeepSeekAvailable(): boolean {
  return Boolean(readEnv("DEEPSEEK_API_KEY"));
}

/**
 * DeepSeek Agent — 字幕智能优化（断句、润色、高亮、风格/动画推荐）
 */
export async function runDeepSeekSubtitlePlan(
  clips: SubtitlePlanClip[],
  task: SubtitleDirectorTask
): Promise<{ plan: SubtitlePlan; cost: number }> {
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return {
      plan: { clips, summary: ["未配置 DEEPSEEK_API_KEY，跳过 AI 优化"] },
      cost: 0,
    };
  }

  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

  const payload = {
    language: task.language ?? "zh",
    style: task.styleTemplate ?? "default",
    maxCharsPerLine: task.maxCharsPerLine ?? 18,
    maxLines: task.maxLines ?? 2,
    clips: clips.map((c) => ({
      id: c.id,
      text: c.text,
      startSec: c.startSec,
      endSec: c.endSec,
    })),
  };

  const system = `你是 AI Cut 字幕中心 DeepSeek Agent。只输出 JSON，不要 markdown。
任务：智能断句、润色口语化表达、推荐 highlightWords、styleRecommendation、animationRecommendation。
约束：不得改变 startSec/endSec；每行字数不超过 maxCharsPerLine；最多 maxLines 行。
输出格式：
{
  "clips": [{ "id", "text", "startSec", "endSec", "highlightWords": [] }],
  "styleRecommendation": "tiktok|documentary|...",
  "animationRecommendation": "fade|typewriter|karaoke|...",
  "summary": ["优化说明"],
  "qaHints": ["质量提示"]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: SubtitlePlan;
  try {
    parsed = JSON.parse(raw) as SubtitlePlan;
  } catch {
    parsed = { clips, summary: ["DeepSeek 返回非 JSON，已回退原字幕"] };
  }

  const merged: SubtitlePlanClip[] = clips.map((orig) => {
    const hit = parsed.clips?.find((c) => c.id === orig.id);
    if (!hit) return orig;
    return {
      ...orig,
      text: hit.text?.trim() || orig.text,
      highlightWords: hit.highlightWords ?? orig.highlightWords,
      animation: hit.animation ?? orig.animation,
    };
  });

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const cost = (inputTokens * 0.28 + outputTokens * 0.42) / 1_000_000;
  recordTokenCost("字幕中心", "字幕分析", "deepseek", "deepseek-chat", inputTokens, outputTokens);

  return {
    plan: {
      clips: merged,
      styleRecommendation: parsed.styleRecommendation,
      animationRecommendation: parsed.animationRecommendation,
      summary: parsed.summary,
      qaHints: parsed.qaHints,
    },
    cost,
  };
}
