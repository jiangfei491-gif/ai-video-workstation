import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import { getVeoConfig } from "@/app/lib/veo/config";
import {
  MATERIAL_CATEGORIES,
  isMaterialLanguage,
  type MaterialLanguage,
  type MaterialSearchProviderChoice,
} from "./types";

export type MaterialSearchProviderId = "gpt" | "gemini";

/** Agent 联网搜索找到的候选素材（入库字段统一为中文） */
export type FoundMaterial = {
  title: string;
  sourceUrl: string;
  sourceSite: string;
  content: string;
  category?: string;
  language?: MaterialLanguage;
};

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const t = raw.trim().replace(/^['"]|['"]$/g, "");
  return t.length > 0 ? t : null;
}

export function listMaterialSearchProviders(): MaterialSearchProviderId[] {
  const out: MaterialSearchProviderId[] = [];
  if (getOpenAIApiKey()) out.push("gpt");
  if (getVeoConfig().apiKey) out.push("gemini");
  return out;
}

function extractJsonArray(text: string): Record<string, unknown>[] {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  } catch {
    /* fall through */
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1].trim()) as unknown;
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    } catch {
      /* fall through */
    }
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("未能从搜索结果解析出 JSON 数组");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>[];
}

export function parseFoundMaterials(text: string, count: number): FoundMaterial[] {
  const arr = extractJsonArray(text);
  return arr
    .slice(0, count)
    .map((x) => {
      const rawLang = String(x.language ?? "").trim();
      const rawCategory = String(x.category ?? "").trim();
      return {
        title: String(x.title ?? "").trim(),
        sourceUrl: String(x.sourceUrl ?? "").trim(),
        sourceSite: String(x.sourceSite ?? "").trim(),
        content: String(x.content ?? "").trim(),
        ...(rawCategory && (MATERIAL_CATEGORIES as readonly string[]).includes(rawCategory)
          ? { category: rawCategory }
          : {}),
        ...(isMaterialLanguage(rawLang) ? { language: rawLang as MaterialLanguage } : {}),
      };
    })
    .filter((m) => m.title);
}

async function searchWithGpt(instruction: string): Promise<{ text: string; model: string }> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");

  const model =
    readEnv("OPENAI_MATERIAL_SEARCH_MODEL") ?? readEnv("OPENAI_MODEL") ?? "gpt-4.1";
  const openai = new OpenAI({ apiKey });
  const res = await openai.responses.create({
    model,
    tools: [{ type: "web_search_preview" }],
    input: instruction,
  });

  const text = (res.output_text ?? "").trim();
  if (!text) throw new Error("GPT 搜索未返回内容");
  return { text, model };
}

async function searchWithGemini(instruction: string): Promise<{ text: string; model: string }> {
  const config = getVeoConfig();
  if (!config.apiKey) throw new Error("未配置 VEO_API_KEY（Gemini）");

  const model = readEnv("GEMINI_TEXT_MODEL") ?? "gemini-2.5-flash";
  const url = `${config.geminiBaseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: instruction }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini 搜索失败 [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(data.error.message);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) throw new Error("Gemini 搜索未返回内容");
  return { text, model };
}

export type MaterialSearchOutcome = {
  items: FoundMaterial[];
  searchProvider: MaterialSearchProviderId;
  searchModel: string;
  triedProviders: MaterialSearchProviderId[];
};

function resolveSearchProviderOrder(
  choice: MaterialSearchProviderChoice
): MaterialSearchProviderId[] {
  const available = listMaterialSearchProviders();
  if (available.length === 0) {
    throw new Error("未配置任何找素材模型（需要 OPENAI_API_KEY 或 VEO_API_KEY）");
  }
  if (choice === "all") return available;
  if (!available.includes(choice)) {
    throw new Error(
      choice === "gpt"
        ? "未配置 OPENAI_API_KEY（GPT 搜索不可用）"
        : "未配置 VEO_API_KEY（Gemini 搜索不可用）"
    );
  }
  return [choice];
}

export async function runMaterialSearch(
  instruction: string,
  count: number,
  providerChoice: MaterialSearchProviderChoice = "all"
): Promise<MaterialSearchOutcome> {
  const providers = resolveSearchProviderOrder(providerChoice);

  const tried: MaterialSearchProviderId[] = [];
  const errors: string[] = [];

  for (const provider of providers) {
    tried.push(provider);
    try {
      const { text, model } =
        provider === "gpt" ? await searchWithGpt(instruction) : await searchWithGemini(instruction);
      const items = parseFoundMaterials(text, count);
      if (items.length === 0) {
        errors.push(`${provider}: 未解析到有效素材`);
        continue;
      }
      return { items, searchProvider: provider, searchModel: model, triedProviders: tried };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      console.warn(`[material-search] ${provider} 失败，尝试下一个`, msg);
    }
  }

  throw new Error(errors.join("；") || "所有搜索模型均失败");
}
