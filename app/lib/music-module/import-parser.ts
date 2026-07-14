/**
 * 从用户粘贴的 ChatGPT 会员输出中提取公版曲目清单
 */
import OpenAI from "openai";
import { extractJsonObject } from "@/app/lib/materials/script-evolution/json";
import { DEEPSEEK_BASE_URL, formatDeepSeekError, getDeepSeekApiKey, musicGptModel } from "./gpt-agent";
import type { MusicSeedTrack, SeedSourceType } from "./types";
import { PUBLIC_CATEGORIES } from "./types";
import { recordTokenCost } from "@/app/lib/cost-ledger/unified";

export type ExtractedSeedDraft = {
  title: string;
  author: string;
  sourceUrl?: string;
  category?: string;
  language?: string;
  note?: string;
  deathYear?: number;
  styleTags?: string[];
};

export type ExtractResult = {
  tracks: MusicSeedTrack[];
  method: "json" | "gpt";
  warnings: string[];
};

function slugSeedId(title: string, author: string): string {
  const raw = `import-${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return raw || `import-${Date.now()}`;
}

function inferSourceType(url: string): SeedSourceType {
  const u = url.toLowerCase();
  if (u.includes("hymnary.org")) return "hymnary";
  if (u.includes("wikisource.org")) return "wikisource";
  return "wikipedia";
}

function normalizeCategory(raw?: string): MusicSeedTrack["category"] {
  const s = (raw ?? "").trim();
  return PUBLIC_CATEGORIES.includes(s as never) ? (s as MusicSeedTrack["category"]) : "其它";
}

function normalizeDrafts(input: unknown): ExtractedSeedDraft[] {
  let rows: unknown[] = [];
  if (Array.isArray(input)) rows = input;
  else if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) rows = obj.candidates;
    else if (Array.isArray(obj.tracks)) rows = obj.tracks;
    else if (Array.isArray(obj.songs)) rows = obj.songs;
    else if (Array.isArray(obj.items)) rows = obj.items;
  }
  const out: ExtractedSeedDraft[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title ?? r.name ?? r.song ?? "").trim();
    if (!title) continue;
    out.push({
      title,
      author: String(r.author ?? r.composer ?? r.lyricist ?? "Traditional").trim() || "Traditional",
      sourceUrl: String(r.sourceUrl ?? r.source_url ?? r.url ?? r.link ?? "").trim() || undefined,
      category: r.category ? String(r.category) : undefined,
      language: r.language ? String(r.language) : undefined,
      note: String(r.note ?? r.reason ?? r.whyValuable ?? r.comment ?? "").trim() || undefined,
      deathYear: typeof r.deathYear === "number" ? r.deathYear : typeof r.death_year === "number" ? r.death_year : undefined,
      styleTags: Array.isArray(r.styleTags)
        ? r.styleTags.filter((t): t is string => typeof t === "string")
        : Array.isArray(r.style_tags)
          ? r.style_tags.filter((t): t is string => typeof t === "string")
          : undefined,
    });
  }
  return out;
}

function tryParseJsonPaste(text: string): ExtractedSeedDraft[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[];
  for (const chunk of candidates) {
    try {
      const parsed = extractJsonObject(chunk);
      const drafts = normalizeDrafts(parsed);
      if (drafts.length) return drafts;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function extractWithGpt(text: string): Promise<ExtractedSeedDraft[]> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");
  const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL, timeout: 120_000, maxRetries: 0 });
  const model = musicGptModel();
  const system = `你是数据提取助手。从用户粘贴的 ChatGPT 对话/列表中提取「公版歌词曲目」结构化清单。
只输出 JSON，不要 markdown。
字段：tracks 数组，每项含 title, author, sourceUrl(可选), category(可选), language(可选), note(可选), deathYear(可选), styleTags(可选字符串数组)。
category 只能从：${PUBLIC_CATEGORIES.join("、")} 中选择，不确定填「其它」。
没有 URL 可留空字符串。尽量提取全部曲目，不要编造不存在的歌。`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text.slice(0, 24_000) },
    ],
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("提取模型未返回内容");
  recordTokenCost("其他", "粘贴导入提取", "deepseek", model, completion.usage?.prompt_tokens ?? 0, completion.usage?.completion_tokens ?? 0);
  try {
    const parsed = extractJsonObject(raw);
    const drafts = normalizeDrafts(parsed);
    if (!drafts.length) throw new Error("未识别到曲目");
    return drafts;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "JSON 解析失败");
  }
}

function draftsToTracks(drafts: ExtractedSeedDraft[]): { tracks: MusicSeedTrack[]; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const tracks: MusicSeedTrack[] = [];
  for (const d of drafts) {
    const id = slugSeedId(d.title, d.author);
    const dedupe = `${d.title}::${d.author}`.toLowerCase();
    if (seen.has(dedupe)) {
      warnings.push(`重复跳过：${d.title} - ${d.author}`);
      continue;
    }
    seen.add(dedupe);
    if (!d.sourceUrl) warnings.push(`缺少来源链接：${d.title}（同步时将跳过）`);
    tracks.push({
      id,
      title: d.title,
      author: d.author,
      category: normalizeCategory(d.category),
      styleTags: d.styleTags?.slice(0, 3) ?? [],
      language: (d.language ?? "en").trim() || "en",
      deathYear: d.deathYear,
      sourceUrl: d.sourceUrl ?? "",
      sourceType: d.sourceUrl ? inferSourceType(d.sourceUrl) : "wikipedia",
      priority: 5,
      note: d.note ?? "用户粘贴导入",
    });
  }
  return { tracks, warnings };
}

/** 从粘贴文本提取曲目（先 JSON，再单次 GPT） */
export async function extractSeedsFromPaste(text: string): Promise<ExtractResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("请先粘贴内容");
  if (trimmed.length < 20) throw new Error("粘贴内容过短");

  const jsonDrafts = tryParseJsonPaste(trimmed);
  if (jsonDrafts?.length) {
    const { tracks, warnings } = draftsToTracks(jsonDrafts);
    return { tracks, method: "json", warnings };
  }

  try {
    const gptDrafts = await extractWithGpt(trimmed);
    const { tracks, warnings } = draftsToTracks(gptDrafts);
    return { tracks, method: "gpt", warnings };
  } catch (e) {
    throw new Error(formatDeepSeekError(e));
  }
}
