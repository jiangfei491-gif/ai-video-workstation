import OpenAI from "openai";
import {
  buildModelCandidates,
  formatOpenAIError,
  getOpenAIApiKey,
  isModelNotFoundError,
} from "@/app/lib/openai-key";
import { recordRequestError, recordUsage } from "@/app/lib/usage-tracker";
import { tokenLineFromUsage } from "@/app/lib/cost-ledger/merge";
import type { DirectorChatUsage } from "@/app/lib/cost-ledger/types";

export type AiVideoModelTask =
  | "title"
  | "script"
  | "script-advanced"
  | "storyboard"
  | "director-storyboard"
  | "narrative-beats"
  | "narrative-shots"
  | "image-budget-planner"
  | "prompts"
  | "video-prompt"
  | "image-prompt"
  | "visual-settings"
  | "edit-plan";

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
    case "narrative-beats":
    case "narrative-shots":
    case "image-budget-planner":
    case "prompts":
    case "video-prompt":
    case "image-prompt":
    case "visual-settings":
    case "edit-plan":
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
): Promise<{ text: string; model: string; usage: DirectorChatUsage }> {
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
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      recordUsage({ model, inputTokens, outputTokens }).catch((err) =>
        console.error("[usage-tracker] record failed", err)
      );
      const usage = tokenLineFromUsage(model, inputTokens, outputTokens);
      return { text, model, usage };
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
