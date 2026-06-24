import { chatCompletion } from "@/app/lib/openai-key";
import type { MaterialAnalysis } from "./types";

const SYSTEM = `你是短视频选题分析师。读用户给的原始素材（标题+正文），按"故事六要素 + 情绪 + 视频潜力"做结构化分析，并判断它适合做什么视频、属于哪个赛道。

只返回 JSON（所有文字用中文，字段必须齐全）：
{
  "summary": "一句话概括这条素材",
  "characters": "主要人物",
  "location": "地点",
  "timeline": "时间",
  "conflict": "核心冲突",
  "twist": "转折",
  "climax": "高潮",
  "ending": "结局",
  "emotion": "主导情绪，如 励志/震撼/悬疑/温情",
  "score": 8.5,
  "tags": ["关键词标签"],
  "suitability": ["长视频" 或 "Shorts" 或 "纪录片" 或 "动画故事" 中适合的若干"],
  "tracks": ["故事" 或 "历史" 或 "悬疑" 或 "财富" 或 "战争" 或 "科技" 或 "未解之谜" 中若干"]
}
score 是视频潜力评分，0-10 一位小数。`;

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}
function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => toStr(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

export async function analyzeMaterial(
  title: string,
  content: string
): Promise<MaterialAnalysis> {
  const { text } = await chatCompletion(
    SYSTEM,
    `标题：${title}\n\n正文：${content || "（无正文，仅凭标题分析）"}`,
    { json: true, maxTokens: 1500 }
  );
  const raw = JSON.parse(text) as Record<string, unknown>;
  const scoreNum = Number(raw.score);
  return {
    summary: toStr(raw.summary),
    characters: toStr(raw.characters),
    location: toStr(raw.location),
    timeline: toStr(raw.timeline),
    conflict: toStr(raw.conflict),
    twist: toStr(raw.twist),
    climax: toStr(raw.climax),
    ending: toStr(raw.ending),
    emotion: toStr(raw.emotion),
    score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(10, scoreNum)) : 0,
    tags: toArr(raw.tags),
    suitability: toArr(raw.suitability),
    tracks: toArr(raw.tracks),
  };
}
