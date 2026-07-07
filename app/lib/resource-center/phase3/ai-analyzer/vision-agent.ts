import fs from "node:fs";

import { extractFramesFromVideo, getVideoDurationSec } from "@/app/lib/veo/first-frame";
import type { AnalysisResultPayload } from "@/database/repositories/resource-center/phase3-interfaces";

import type { AnalyzerInput } from "../types";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// 视频抽帧：每 N 秒 1 帧，不设上限（长视频自然抽更多、更准）
const FRAME_INTERVAL_SEC = 3;

function geminiKey(): string | undefined {
  return (process.env.GEMINI_API_KEY || process.env.VEO_API_KEY || process.env.GOOGLE_API_KEY)?.trim() || undefined;
}

/** 图片/视频类才用视觉分析 */
export function isVisionCandidate(input: AnalyzerInput): boolean {
  const mime = input.mimeType || "";
  const types = input.sourceResourceTypes ?? [];
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    types.includes("image") ||
    types.includes("video") ||
    types.includes("effect")
  );
}

export function isVisionAvailable(): boolean {
  return Boolean(geminiKey());
}

/** 取要送给 Gemini 的图片帧（图片=原图；视频=按秒抽帧） */
function collectFrames(input: AnalyzerInput): { data: Buffer; mime: string }[] {
  const mime = input.mimeType || "";
  const types = input.sourceResourceTypes ?? [];
  const isVideo = mime.startsWith("video/") || types.includes("video") || types.includes("effect");
  if (isVideo) {
    const dur = getVideoDurationSec(input.localPath);
    // 每 FRAME_INTERVAL_SEC 秒 1 帧，不设上限：10s→3帧、60s→20帧、越长越多
    const count = Math.max(1, Math.floor(dur / FRAME_INTERVAL_SEC) || 1);
    const frames = extractFramesFromVideo(input.localPath, count);
    return frames.map((data) => ({ data, mime: "image/jpeg" }));
  }
  // 图片：直接读原文件
  const buf = fs.readFileSync(input.localPath);
  return [{ data: buf, mime: mime.startsWith("image/") ? mime : "image/jpeg" }];
}

const PROMPT = `你是素材内容分析助手。看这些图片/视频帧，用中文输出严格 JSON（不要多余文字）：
{"category":"简短分类","tags":["内容标签","5-8个","具体到画面里的物体/场景/人物/风格"],"description":"一句话画面描述","mood":"氛围","style":"风格","rating":0到5的质量分}
标签要具体（如"日落 海滩 人物 航拍 城市"），不要泛词。`;

function stripJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

/** 用 Gemini 视觉分析图片/视频，返回与 DeepSeek 分析同结构的结果 */
export async function runVisionResourceAnalysis(
  input: AnalyzerInput
): Promise<{ result: AnalysisResultPayload; cost: number }> {
  const key = geminiKey();
  if (!key) throw new Error("未配置 Gemini key（GEMINI_API_KEY / VEO_API_KEY）");

  const frames = collectFrames(input);
  if (frames.length === 0) throw new Error("未能取得可分析的画面帧");

  const parts: unknown[] = [
    { text: PROMPT },
    ...frames.map((f) => ({ inline_data: { mime_type: f.mime, data: f.data.toString("base64") } })),
  ];

  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal: AbortSignal.timeout(60000),
  });
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    error?: { message?: string };
  };
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: {
    category?: string;
    tags?: string[];
    description?: string;
    mood?: string;
    style?: string;
    rating?: number;
  } = {};
  try {
    parsed = JSON.parse(stripJson(text));
  } catch {
    parsed = { description: text.slice(0, 200) };
  }

  const u = data.usageMetadata ?? {};
  const cost = (u.promptTokenCount ?? 0) / 1e6 * 0.3 + (u.candidatesTokenCount ?? 0) / 1e6 * 2.5;

  // 库归属仍按来源类型（视觉只负责内容标签，不改库）
  const libraryId = input.sourceResourceTypes?.[0];
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean).slice(0, 8) : [];

  const result: AnalysisResultPayload = {
    resourceType: libraryId,
    libraryId,
    title: input.filename,
    category: parsed.category || input.sourceCategory || libraryId,
    recommendedCategory: parsed.category,
    tags,
    keywords: tags,
    description: parsed.description || "",
    mood: parsed.mood,
    style: parsed.style,
    rating: typeof parsed.rating === "number" ? Math.max(0, Math.min(5, parsed.rating)) : 3.5,
    qualityScore: typeof parsed.rating === "number" ? Math.max(0, Math.min(1, parsed.rating / 5)) : 0.7,
    canImport: true,
    model: `${GEMINI_MODEL} (vision, ${frames.length}帧)`,
    analyzedAt: new Date().toISOString(),
  };
  return { result, cost };
}
