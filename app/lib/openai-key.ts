import OpenAI from "openai";
import { recordRequestError, recordUsage } from "./usage-tracker";

export function getOpenAIApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return null;
  const key = raw.trim().replace(/^['"]|['"]$/g, "");
  return key.length > 0 ? key : null;
}

/** 可选：中转/代理 API 地址，例如 https://api.openai.com/v1 */
export function getOpenAIBaseURL(): string | undefined {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  return raw || undefined;
}

/** 统一 OpenAI 客户端（支持代理、超时、自动重试） */
export function createOpenAIClient(apiKey?: string, opts?: { maxRetries?: number }): OpenAI {
  const key = apiKey ?? getOpenAIApiKey();
  if (!key) throw new Error("未配置 OPENAI_API_KEY");
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 120_000;
  const envRetries = Number(process.env.OPENAI_MAX_RETRIES) || 4;
  const maxRetries = opts?.maxRetries ?? envRetries;
  return new OpenAI({
    apiKey: key,
    baseURL: getOpenAIBaseURL(),
    timeout: timeoutMs,
    maxRetries,
  });
}

export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("connection error") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up") ||
    msg.includes("network")
  );
}

export function isRetryableOpenAIError(err: unknown): boolean {
  if (isConnectionError(err)) return true;
  if (!(err instanceof OpenAI.APIError)) return false;
  // 额度用尽时重试无意义
  if (err.status === 429 && err.code === "insufficient_quota") return false;
  return err.status === 429 || err.status === 500 || err.status === 502 || err.status === 503;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  if (isConnectionError(err)) {
    const base = getOpenAIBaseURL();
    return base
      ? `OpenAI 网络连接失败（代理 ${base}）。请检查网络、代理是否可用，或稍后重试。`
      : "OpenAI 网络连接失败。请检查本机能否访问 api.openai.com，或在 .env.local 配置 OPENAI_BASE_URL 使用中转地址。";
  }
  if (err instanceof OpenAI.APIError) {
    if (err.code === "insufficient_quota") {
      return "OpenAI 账户额度不足。请在 platform.openai.com 检查余额与计费，或更换有效 API Key。";
    }
    return `OpenAI 接口 [${err.status ?? "网络"}] ${err.code ?? "错误"}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** 带退避重试的 chat completion 调用 */
export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; label?: string }
): Promise<T> {
  const attempts = Math.max(1, opts?.attempts ?? 3);
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableOpenAIError(err) || i >= attempts - 1) break;
      const delay = Math.min(12_000, 1500 * 2 ** i);
      console.warn(
        `[openai] ${opts?.label ?? "request"} 失败，${delay}ms 后重试 (${i + 1}/${attempts})：`,
        err instanceof Error ? err.message : err
      );
      await sleep(delay);
    }
  }
  throw lastError;
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

  const openai = createOpenAIClient(apiKey);
  const modelCandidates = buildModelCandidates();
  let lastError: unknown;
  let lastModel = modelCandidates[0] ?? "gpt-4.1";

  for (const model of modelCandidates) {
    lastModel = model;
    try {
      const completion = await withOpenAIRetry(
        () =>
          openai.chat.completions.create({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            ...(options?.json ? { response_format: { type: "json_object" } } : {}),
          }),
        { attempts: 3, label: `chat/${model}` }
      );
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("模型未返回有效内容");
      trackCompletionUsage(model, completion.usage);
      return { text, model };
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) continue;
      if (isRetryableOpenAIError(err)) continue;
      recordRequestError(model).catch(() => {});
      throw new Error(formatOpenAIError(err));
    }
  }

  recordRequestError(lastModel).catch(() => {});
  throw new Error(formatOpenAIError(lastError));
}
