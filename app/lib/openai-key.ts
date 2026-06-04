import OpenAI from "openai";
import { recordRequestError, recordUsage } from "./usage-tracker";

export function getOpenAIApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return null;
  const key = raw.trim().replace(/^['"]|['"]$/g, "");
  return key.length > 0 ? key : null;
}

export function buildModelCandidates(): string[] {
  const fromEnv = process.env.OPENAI_MODEL?.trim();
  const defaults = [fromEnv, "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"];
  return [...new Set(defaults.filter((m): m is string => Boolean(m)))];
}

export function isModelNotFoundError(err: unknown): boolean {
  if (!(err instanceof OpenAI.APIError)) return false;
  return err.status === 404 || err.code === "model_not_found";
}

export function formatOpenAIError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    return `OpenAI API [${err.status}] ${err.code ?? "error"}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function trackCompletionUsage(
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
): void {
  if (!usage) return;
  recordUsage({
    model,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }).catch((err) => console.error("[usage-tracker] record failed", err));
}

export async function chatCompletion(
  system: string,
  user: string,
  options?: { json?: boolean; maxTokens?: number }
): Promise<{ text: string; model: string }> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未读取到 OPENAI_API_KEY，请配置 .env.local 后重启");

  const openai = new OpenAI({ apiKey });
  const modelCandidates = buildModelCandidates();
  let lastError: unknown;
  let lastModel = modelCandidates[0] ?? "gpt-4.1";

  for (const model of modelCandidates) {
    lastModel = model;
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        ...(options?.json ? { response_format: { type: "json_object" } } : {}),
      });
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("模型未返回有效内容");
      trackCompletionUsage(model, completion.usage);
      return { text, model };
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) continue;
      recordRequestError(model).catch(() => {});
      throw new Error(formatOpenAIError(err));
    }
  }

  recordRequestError(lastModel).catch(() => {});
  throw new Error(formatOpenAIError(lastError));
}
