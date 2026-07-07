import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import { getVeoConfig } from "@/app/lib/veo/config";
import { recordEvolutionApiCall } from "./evolution-usage";
import type { ScriptProviderId } from "./types";

export type ProviderChatResult = {
  text: string;
  model: string;
  provider: ScriptProviderId;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export type ProviderChatOptions = {
  json?: boolean;
  maxTokens?: number;
  phase?: string;
};

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const t = raw.trim().replace(/^['"]|['"]$/g, "");
  return t.length > 0 ? t : null;
}

function trackCall(
  phase: string | undefined,
  provider: ScriptProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number,
  started: number
): void {
  recordEvolutionApiCall({
    phase: phase ?? "chat",
    provider,
    model,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - started,
  });
}

export function listAvailableProviders(): ScriptProviderId[] {
  const out: ScriptProviderId[] = [];
  if (readEnv("ANTHROPIC_API_KEY")) out.push("claude");
  if (getOpenAIApiKey()) out.push("gpt");
  if (getVeoConfig().apiKey) out.push("gemini");
  if (readEnv("DEEPSEEK_API_KEY")) out.push("deepseek");
  return out;
}

export function pickJudgeProvider(generator: ScriptProviderId): ScriptProviderId {
  const available = listAvailableProviders();
  const preference: Record<ScriptProviderId, ScriptProviderId[]> = {
    gpt: ["claude", "gemini", "deepseek", "gpt"],
    claude: ["gpt", "gemini", "deepseek", "claude"],
    gemini: ["gpt", "claude", "deepseek", "gemini"],
    deepseek: ["claude", "gpt", "gemini", "deepseek"],
  };
  for (const candidate of preference[generator]) {
    if (candidate !== generator && available.includes(candidate)) return candidate;
  }
  return available.find((p) => p !== generator) ?? generator;
}

async function chatOpenAI(
  system: string,
  user: string,
  options?: ProviderChatOptions
): Promise<ProviderChatResult> {
  const started = Date.now();
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");
  const model = readEnv("OPENAI_EVOLUTION_MODEL") ?? readEnv("OPENAI_MODEL") ?? "gpt-4.1";
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.75,
    max_tokens: options?.maxTokens ?? 2048,
    ...(options?.json ? { response_format: { type: "json_object" } } : {}),
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("OpenAI 未返回内容");
  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  trackCall(options?.phase, "gpt", model, inputTokens, outputTokens, started);
  return { text, model, provider: "gpt", inputTokens, outputTokens, durationMs: Date.now() - started };
}

async function chatGemini(
  system: string,
  user: string,
  options?: ProviderChatOptions
): Promise<ProviderChatResult> {
  const started = Date.now();
  const config = getVeoConfig();
  if (!config.apiKey) throw new Error("未配置 VEO_API_KEY（Gemini）");
  const model = readEnv("GEMINI_TEXT_MODEL") ?? "gemini-2.5-flash";
  const url = `${config.geminiBaseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const prompt = options?.json
    ? `${system}\n\n${user}\n\n只返回合法 JSON，不要代码块。`
    : `${system}\n\n${user}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: options?.maxTokens ?? 2048,
        ...(options?.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini 文本接口失败 [${res.status}]: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) throw new Error("Gemini 未返回内容");
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  trackCall(options?.phase, "gemini", model, inputTokens, outputTokens, started);
  return { text, model, provider: "gemini", inputTokens, outputTokens, durationMs: Date.now() - started };
}

async function chatAnthropic(
  system: string,
  user: string,
  options?: ProviderChatOptions
): Promise<ProviderChatResult> {
  const started = Date.now();
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("未配置 ANTHROPIC_API_KEY");
  const model = readEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 2048,
      system: options?.json ? `${system}\n只返回合法 JSON。` : system,
      messages: [{ role: "user", content: user }],
      temperature: 0.75,
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic 接口失败 [${res.status}]: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new Error("Claude 未返回内容");
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  trackCall(options?.phase, "claude", model, inputTokens, outputTokens, started);
  return { text, model, provider: "claude", inputTokens, outputTokens, durationMs: Date.now() - started };
}

async function chatDeepSeek(
  system: string,
  user: string,
  options?: ProviderChatOptions
): Promise<ProviderChatResult> {
  const started = Date.now();
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");
  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const openai = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.75,
    max_tokens: options?.maxTokens ?? 2048,
    ...(options?.json ? { response_format: { type: "json_object" } } : {}),
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("DeepSeek 未返回内容");
  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  trackCall(options?.phase, "deepseek", model, inputTokens, outputTokens, started);
  return { text, model, provider: "deepseek", inputTokens, outputTokens, durationMs: Date.now() - started };
}

export async function providerChat(
  provider: ScriptProviderId,
  system: string,
  user: string,
  options?: ProviderChatOptions
): Promise<ProviderChatResult> {
  switch (provider) {
    case "gpt":
      return chatOpenAI(system, user, options);
    case "gemini":
      return chatGemini(system, user, options);
    case "claude":
      return chatAnthropic(system, user, options);
    case "deepseek":
      return chatDeepSeek(system, user, options);
    default:
      throw new Error(`未知模型提供方：${provider}`);
  }
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
