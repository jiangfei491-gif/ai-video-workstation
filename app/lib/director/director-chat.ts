import OpenAI from "openai";
import {
  buildModelCandidates,
  formatOpenAIError,
  getOpenAIApiKey,
  isModelNotFoundError,
} from "@/app/lib/openai-key";
import { recordRequestError, recordUsage } from "@/app/lib/usage-tracker";

export type AiVideoModelTask =
  | "title"
  | "script"
  | "script-advanced"
  | "storyboard"
  | "director-storyboard"
  | "prompts"
  | "video-prompt";

type ChatOptions = {
  json?: boolean;
  maxTokens?: number;
};

function resolveAiVideoModel(task: AiVideoModelTask): string {
  switch (task) {
    case "title":
      return "gpt-4.1-mini";
    case "script":
    case "script-advanced":
    case "storyboard":
    case "director-storyboard":
    case "prompts":
    case "video-prompt":
      return "gpt-4.1";
    default:
      return "gpt-4.1";
  }
}

function buildModelOrder(task: AiVideoModelTask): string[] {
  const preferred = resolveAiVideoModel(task);
  return [...new Set([preferred, ...buildModelCandidates()])];
}

export async function directorChatCompletion(
  task: AiVideoModelTask,
  system: string,
  user: string,
  options?: ChatOptions
): Promise<{ text: string; model: string }> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未读取到 OPENAI_API_KEY，请配置 .env.local 后重启");

  const openai = new OpenAI({ apiKey });
  const models = buildModelOrder(task);
  let lastError: unknown;
  let lastModel = models[0] ?? "gpt-4.1";

  for (const model of models) {
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
      recordUsage({
        model,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      }).catch((err) => console.error("[usage-tracker] record failed", err));
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
