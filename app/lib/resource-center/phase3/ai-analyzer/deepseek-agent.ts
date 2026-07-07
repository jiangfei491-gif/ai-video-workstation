import OpenAI from "openai";

import { LIBRARY_BY_ID } from "../../libraries/definitions";
import type { LibraryId } from "../../types";
import type { AnalysisResultPayload, AnalyzerInput } from "../types";
import {
  guessLibraryFromFilename,
  mapSourceTypesToLibrary,
} from "../types";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function isDeepSeekAvailable(): boolean {
  return Boolean(readEnv("DEEPSEEK_API_KEY"));
}

function ruleBasedAnalysis(input: AnalyzerInput): AnalysisResultPayload {
  const hint =
    mapSourceTypesToLibrary(input.sourceResourceTypes ?? []) ??
    guessLibraryFromFilename(input.filename);
  const def = LIBRARY_BY_ID[hint];
  const base = input.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  const category =
    def.categories.find((c) => input.sourceCategory?.includes(c)) ??
    def.categories[0] ??
    "general";

  return {
    resourceType: hint,
    libraryId: hint,
    title: base || input.filename,
    category,
    recommendedCategory: category,
    tags: [hint, category, ...(input.sourceResourceTypes ?? [])].slice(0, 8),
    keywords: base.split(/\s+/).filter(Boolean).slice(0, 12),
    description: `${def.titleZh}资源：${input.filename}`,
    language: input.sourceLanguage ?? "zh",
    style: input.sourceCategory ?? "general",
    mood: "neutral",
    purpose: "production",
    platform: "general",
    qualityScore: 0.72,
    rating: 3.5,
    isDuplicate: false,
    canImport: true,
    model: "rule-fallback",
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * DeepSeek AI Analyzer — 统一资源分析（唯一分析模型）
 */
export async function runDeepSeekResourceAnalysis(
  input: AnalyzerInput
): Promise<{ result: AnalysisResultPayload; cost: number }> {
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return { result: ruleBasedAnalysis(input), cost: 0 };
  }

  const libraryIds = Object.keys(LIBRARY_BY_ID) as LibraryId[];
  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

  const system = `你是 AI Video OS Resource Center 的 AI Analyzer。
只输出 JSON，不要 markdown。
libraryId 必须是以下之一：${libraryIds.join(", ")}。
分析下载资源并输出统一结构。`;

  const user = JSON.stringify({
    filename: input.filename,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    sha256: input.sha256,
    sourceResourceTypes: input.sourceResourceTypes,
    sourceCategory: input.sourceCategory,
    sourceLanguage: input.sourceLanguage,
    remoteUrl: input.remoteUrl,
    metadata: input.metadata,
    libraries: libraryIds.map((id) => ({
      id,
      titleZh: LIBRARY_BY_ID[id].titleZh,
      categories: LIBRARY_BY_ID[id].categories,
    })),
  });

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `分析此资源并返回 JSON 字段：
resourceType, libraryId, title, category, recommendedCategory, tags[], keywords[],
description, language, style, mood, purpose, platform, qualityScore(0-1), rating(0-5),
isDuplicate, canImport, rejectReason

输入：${user}`,
      },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: AnalysisResultPayload;
  try {
    parsed = JSON.parse(raw) as AnalysisResultPayload;
  } catch {
    parsed = ruleBasedAnalysis(input);
  }

  const libraryId = (parsed.libraryId ?? parsed.resourceType ?? guessLibraryFromFilename(input.filename)) as LibraryId;
  if (!LIBRARY_BY_ID[libraryId]) {
    parsed.libraryId = guessLibraryFromFilename(input.filename);
  } else {
    parsed.libraryId = libraryId;
  }

  parsed.model = model;
  parsed.analyzedAt = new Date().toISOString();
  if (parsed.canImport === undefined) parsed.canImport = true;
  if (parsed.isDuplicate === undefined) parsed.isDuplicate = false;

  const cost =
    ((completion.usage?.prompt_tokens ?? 0) * 0.14 +
      (completion.usage?.completion_tokens ?? 0) * 0.28) /
    1_000_000;

  return { result: parsed, cost };
}

export { ruleBasedAnalysis };
