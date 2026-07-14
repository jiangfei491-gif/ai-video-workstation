/**
 * 音乐模块 GPT Agent
 * 公版：种子抓取后解析+评分 / 原创：创作·修改
 * 成本策略：固定单模型 deepseek-chat，不重试、不切换备用模型
 * （原用 OpenAI gpt-4o-mini，因账户额度不足改用 DeepSeek——DeepSeek 走 OpenAI 兼容协议，仅换 baseURL/Key，其余调用方式不变）
 */
import OpenAI from "openai";
import { recordTokenCost } from "@/app/lib/cost-ledger/unified";
import { extractJsonObject } from "@/app/lib/materials/script-evolution/json";
import {
  COMMERCIAL_TAGS,
  COVER_HOTNESS_LEVELS,
  MIN_PUBLIC_OVERALL_SCORE,
  MOOD_TAGS,
  PUBLIC_CATEGORIES,
  SCENE_TAGS,
  STYLE_TAGS,
  type CoverHotnessAnalysis,
  type OriginalPrompt,
  type PublicLyricScores,
} from "./types";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export function getDeepSeekApiKey(): string | null {
  const raw = process.env.DEEPSEEK_API_KEY;
  if (!raw) return null;
  const key = raw.trim().replace(/^['"]|['"]$/g, "");
  return key.length > 0 ? key : null;
}

export function formatDeepSeekError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("fetch failed")) {
      return "DeepSeek 网络连接失败。请检查本机能否访问 api.deepseek.com。";
    }
  }
  if (err instanceof OpenAI.APIError) {
    if (err.code === "insufficient_quota" || err.status === 402) {
      return "DeepSeek 账户余额不足。请在 platform.deepseek.com 充值，或更换有效 API Key。";
    }
    return `DeepSeek 接口 [${err.status ?? "网络"}] ${err.code ?? "错误"}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** 音乐模块唯一模型（可用 MUSIC_GPT_MODEL 覆盖，默认 DeepSeek 最便宜档） */
export function musicGptModel(): string {
  return (
    process.env.MUSIC_GPT_MODEL?.trim() ||
    process.env.DEEPSEEK_MODEL?.trim() ||
    "deepseek-chat"
  );
}

export function isGptAvailable(): boolean {
  return Boolean(getDeepSeekApiKey());
}

function parseGptJson<T>(text: string): T {
  if (!text.trim()) throw new SyntaxError("empty");
  return extractJsonObject(text) as T;
}

function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  return err instanceof Error && /JSON|json|解析/.test(err.message);
}

/** 安全取字符串字段：模型对"字符串"字段偶发返回数字/其它类型（如 firstPublished 给年份数字），不能假设一定是 string */
function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

async function gptJson<T>(
  system: string,
  user: string,
  operation: string,
  opts?: { maxCompletionTokens?: number }
): Promise<{ data: T; model: string }> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");
  const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL, timeout: 120_000, maxRetries: 0 });
  const model = musicGptModel();

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: opts?.maxCompletionTokens ?? 4096,
      response_format: { type: "json_object" },
    });
    const choice = completion.choices[0];
    const text = choice?.message?.content?.trim() ?? "";
    if (!text) {
      throw new Error(`模型 ${model} 未返回内容（finish_reason=${choice?.finish_reason ?? "unknown"}）`);
    }
    if (choice?.finish_reason === "length") {
      throw new Error(`模型 ${model} 响应被截断，请减少单次处理数量`);
    }
    const usage = completion.usage;
    recordTokenCost("其他", operation, "deepseek", model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0);
    return { data: parseGptJson<T>(text), model };
  } catch (err) {
    if (isJsonParseError(err)) {
      throw new Error("DeepSeek 返回非 JSON。请稍后重试或减少单次处理数量。");
    }
    throw new Error(formatDeepSeekError(err));
  }
}

// ── 公版：解析 + 评分 + 分类 + 标记 ─────────────────────────────────────────────

export type ParsedPublicLyric = {
  title: string;
  titleZh: string;
  body: string;
  lyricZhRemark: string;
  author: string;
  birthYear?: number;
  deathYear?: number;
  country: string;
  language: string;
  firstPublished: string;
  category: string;
  moodTags: string[];
  sceneTags: string[];
  styleTags: string[];
  commercialTags: string[];
  isPublicDomain: boolean;
  publicDomainReason: string;
  scores: PublicLyricScores;
  coverAnalysis: CoverHotnessAnalysis;
};

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeHotness(v: unknown): string {
  const s = String(v ?? "").trim();
  return COVER_HOTNESS_LEVELS.includes(s as (typeof COVER_HOTNESS_LEVELS)[number]) ? s : "★★☆☆☆";
}

function normalizeScores(raw: Partial<PublicLyricScores> & { overall?: number }): PublicLyricScores {
  const scores: PublicLyricScores = {
    commercialValue: clampScore(raw.commercialValue),
    internationalFame: clampScore(raw.internationalFame),
    coverHotness: clampScore(raw.coverHotness),
    modernSpread: clampScore(raw.modernSpread),
    adaptationPotential: clampScore(raw.adaptationPotential),
    aiCompositionFit: clampScore(raw.aiCompositionFit),
    storyRichness: clampScore(raw.storyRichness),
    emotionalRichness: clampScore(raw.emotionalRichness),
    lyricQuality: clampScore(raw.lyricQuality),
    melodyAdaptation: clampScore(raw.melodyAdaptation),
    contentCreationPotential: clampScore(raw.contentCreationPotential),
    overall: clampScore(raw.overall),
  };
  if (!scores.overall) {
    scores.overall = Math.round(
      scores.commercialValue * 0.14 +
        scores.internationalFame * 0.1 +
        scores.coverHotness * 0.1 +
        scores.modernSpread * 0.1 +
        scores.adaptationPotential * 0.1 +
        scores.aiCompositionFit * 0.12 +
        scores.storyRichness * 0.06 +
        scores.emotionalRichness * 0.06 +
        scores.lyricQuality * 0.08 +
        scores.melodyAdaptation * 0.08 +
        scores.contentCreationPotential * 0.06
    );
  }
  return scores;
}

export async function parseAndClassify(
  rawText: string,
  sourceUrl: string,
  discoverReason?: string
): Promise<{ parsed: ParsedPublicLyric; model: string }> {
  const system = `你是公版歌词「商业价值资产」解析与评分专家（GPT-5.5）。

任务：从网页提取歌词与元数据，判断是否公版，评估商业/AI创作/现代改编/传播价值，自动分类打标签。
综合评分低于 ${MIN_PUBLIC_OVERALL_SCORE} 的作品不应被收录（但仍需完整输出评分供系统过滤）。

【现代翻唱热度分析】必须分析：
- 是否仍有歌手翻唱 / YouTube 传播 / 主流音乐平台传播
- 是否仍用于影视、电视剧、动漫、游戏
- 是否仍具全球传播与商业改编价值 / 是否适合 AI 重新创作
输出 coverAnalysis.stars：${COVER_HOTNESS_LEVELS.join(" / ")}
并写 includeReason（为什么值得收录）与 excludeReason（为什么不值得收录，若值得收录可简短写「无」）

【评分项】每项 0-100 整数：
commercialValue, internationalFame, coverHotness, modernSpread, adaptationPotential,
aiCompositionFit, storyRichness, emotionalRichness, lyricQuality, melodyAdaptation,
contentCreationPotential, overall（综合分，加权平均）

【分类】
- category 主题单选：${PUBLIC_CATEGORIES.join("/")}
- moodTags：${MOOD_TAGS.join("/")} 选 0-3
- sceneTags：${SCENE_TAGS.join("/")} 选 0-3
- styleTags：${STYLE_TAGS.join("/")} 选 0-3
- commercialTags：从 ${COMMERCIAL_TAGS.join("/")} 选 0-6 个真正匹配的

【公版】isPublicDomain 不确定或疑似有版权 → false
【非中文】必须提供 titleZh 与 lyricZhRemark（译文可精简，保留完整意思）；中文则留空字符串
【无正文】body 留空
includeReason / excludeReason 各不超过 80 字

只输出 JSON（无 markdown）：
{
 "title","titleZh","body","lyricZhRemark","author","birthYear","deathYear","country","language","firstPublished",
 "category","moodTags":[],"sceneTags":[],"styleTags":[],"commercialTags":[],
 "isPublicDomain":true,"publicDomainReason":"",
 "scores":{ "commercialValue":0,"internationalFame":0,"coverHotness":0,"modernSpread":0,"adaptationPotential":0,
   "aiCompositionFit":0,"storyRichness":0,"emotionalRichness":0,"lyricQuality":0,"melodyAdaptation":0,
   "contentCreationPotential":0,"overall":0 },
 "coverAnalysis":{
   "stars":"★★★☆☆","stillCoveredBySingers":false,"stillOnYoutube":false,"stillOnStreamingPlatforms":false,
   "usedInFilmTvAnimeGames":false,"globalSpreadAbility":false,"commercialAdaptationValue":false,
   "suitableForAiRecreation":false,"includeReason":"","excludeReason":""
 }
}`;

  const user = JSON.stringify({
    sourceUrl,
    discoverReason,
    rawText: rawText.slice(0, 10000),
  });
  const { data, model } = await gptJson<Partial<ParsedPublicLyric>>(
    system,
    user,
    "公版歌词解析评分",
    { maxCompletionTokens: 8192 }
  );

  const scores = normalizeScores(data.scores ?? {});
  const coverAnalysis: CoverHotnessAnalysis = {
    stars: normalizeHotness(data.coverAnalysis?.stars),
    stillCoveredBySingers: Boolean(data.coverAnalysis?.stillCoveredBySingers),
    stillOnYoutube: Boolean(data.coverAnalysis?.stillOnYoutube),
    stillOnStreamingPlatforms: Boolean(data.coverAnalysis?.stillOnStreamingPlatforms),
    usedInFilmTvAnimeGames: Boolean(data.coverAnalysis?.usedInFilmTvAnimeGames),
    globalSpreadAbility: Boolean(data.coverAnalysis?.globalSpreadAbility),
    commercialAdaptationValue: Boolean(data.coverAnalysis?.commercialAdaptationValue),
    suitableForAiRecreation: Boolean(data.coverAnalysis?.suitableForAiRecreation),
    includeReason: str(data.coverAnalysis?.includeReason),
    excludeReason: str(data.coverAnalysis?.excludeReason),
  };

  const parsed: ParsedPublicLyric = {
    title: str(data.title) || "未命名",
    titleZh: str(data.titleZh),
    body: str(data.body),
    lyricZhRemark: str(data.lyricZhRemark),
    author: str(data.author),
    birthYear: typeof data.birthYear === "number" ? data.birthYear : undefined,
    deathYear: typeof data.deathYear === "number" ? data.deathYear : undefined,
    country: str(data.country),
    language: str(data.language),
    firstPublished: str(data.firstPublished),
    category: PUBLIC_CATEGORIES.includes((data.category as never)) ? String(data.category) : "其它",
    moodTags: filterTags(data.moodTags, MOOD_TAGS),
    sceneTags: filterTags(data.sceneTags, SCENE_TAGS),
    styleTags: filterTags(data.styleTags, STYLE_TAGS),
    commercialTags: filterTags(data.commercialTags, COMMERCIAL_TAGS, 6),
    isPublicDomain: data.isPublicDomain !== false,
    publicDomainReason: str(data.publicDomainReason),
    scores,
    coverAnalysis,
  };
  return { parsed, model };
}

export function passesPublicScoreGate(scores: PublicLyricScores): boolean {
  return scores.overall >= MIN_PUBLIC_OVERALL_SCORE;
}

function filterTags(input: unknown, allowed: readonly string[], max = 3): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((t): t is string => typeof t === "string" && allowed.includes(t)).slice(0, max);
}

// ── 原创：创作 / 重新生成 / 继续 / 修改 ─────────────────────────────────────────

export async function createLyric(prompt: OriginalPrompt): Promise<{
  title: string;
  titleZh: string;
  body: string;
  lyricZhRemark: string;
  model: string;
}> {
  const lang = prompt.language ?? "zh";
  const needZh = lang !== "zh" && lang !== "中文";
  const system = `你是原创歌词创作专家（GPT-5.5）。根据用户参数创作完整原创歌词。只输出 JSON。
${needZh ? "歌词使用指定语言创作；同时必须提供 titleZh（中文歌名）和 lyricZhRemark（歌词全文中文译文）。" : "歌词为中文时 titleZh 和 lyricZhRemark 留空。"}
输出：{ "title":"歌名", "titleZh":"", "body":"完整歌词", "lyricZhRemark":"" }`;
  const { data, model } = await gptJson<{ title: string; titleZh?: string; body: string; lyricZhRemark?: string }>(
    system,
    JSON.stringify(prompt),
    "原创歌词创作"
  );
  return {
    title: str(data.title) || "未命名",
    titleZh: str(data.titleZh),
    body: str(data.body),
    lyricZhRemark: str(data.lyricZhRemark),
    model,
  };
}

export async function continueLyric(
  currentBody: string,
  prompt: OriginalPrompt
): Promise<{ body: string; model: string }> {
  const system = `你是原创歌词创作专家。在已有歌词基础上「继续创作」，自然衔接后续段落，保持风格一致。只输出 JSON。
输出：{ "body":"包含原文 + 新增段落的完整歌词" }`;
  const { data, model } = await gptJson<{ body: string }>(
    system,
    JSON.stringify({ prompt, currentBody }),
    "原创歌词继续"
  );
  return { body: str(data.body) || currentBody, model };
}

export async function reviseLyric(
  currentBody: string,
  instruction: string
): Promise<{ body: string; model: string }> {
  const system = `你是原创歌词编辑专家。按用户要求修改歌词。只输出 JSON。
输出：{ "body":"修改后的完整歌词" }`;
  const { data, model } = await gptJson<{ body: string }>(
    system,
    JSON.stringify({ instruction, currentBody }),
    "原创歌词修改"
  );
  return { body: str(data.body) || currentBody, model };
}
