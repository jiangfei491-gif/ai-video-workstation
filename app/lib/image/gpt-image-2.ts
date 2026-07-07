import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import {
  generateBflFlux,
  isBflConfigured,
} from "./providers/bfl-flux-provider";
import { generateFalFlux, isFalConfigured } from "./providers/fal-flux-provider";
import { describeImageError } from "./providers/router";

const PRIMARY_MODEL = "gpt-image-2";
const FALLBACK_MODEL = "gpt-image-1";

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export type GenerateImageResult = {
  buffer: Buffer;
  model: string;
  /** gpt-image-2 / gpt-image-1 / flux-dev / flux-schnell 等 */
  source: string;
};

async function tryOpenAI(
  apiKey: string,
  prompt: string,
  size: ImageSize,
  count: number
): Promise<GenerateImageResult[]> {
  const openai = new OpenAI({ apiKey });
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (const model of models) {
    try {
      const result = await openai.images.generate({ model, prompt, n: count, size });
      const items = result.data ?? [];
      if (items.length === 0) throw new Error(`${model} 未返回图片`);
      return items.map((item) => {
        const b64 = item.b64_json;
        if (!b64) throw new Error(`${model} 未返回 b64_json`);
        return {
          buffer: Buffer.from(b64, "base64"),
          model,
          source: model === PRIMARY_MODEL ? "gpt-image-2" : "gpt-image-1",
        } as GenerateImageResult;
      });
    } catch (err) {
      lastError = err;
      if (model === FALLBACK_MODEL) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** OpenAI 失败/无额度时的 Flux 回退（BFL → FAL） */
async function fluxFallback(
  prompt: string,
  size: ImageSize,
  count: number
): Promise<GenerateImageResult[]> {
  const input = { prompt, size, count };
  const out = isBflConfigured()
    ? await generateBflFlux("flux-dev", input)
    : await generateFalFlux("flux-dev", input);
  return out.map((o) => ({ buffer: o.buffer, model: o.model, source: o.providerId }));
}

/**
 * 生成图像：优先 OpenAI（gpt-image-2 → gpt-image-1），
 * OpenAI 失败或没额度时自动回退 Flux（BFL → FAL）。
 * 两者都不可用时抛出面向用户的明确提示。
 */
export async function generateImageWithGptImage2(
  prompt: string,
  size: ImageSize = "1024x1536",
  n = 1
): Promise<GenerateImageResult[]> {
  const count = Math.max(1, Math.min(8, n));
  const apiKey = getOpenAIApiKey();
  const hasFlux = isBflConfigured() || isFalConfigured();

  if (apiKey) {
    try {
      return await tryOpenAI(apiKey, prompt, size, count);
    } catch (err) {
      if (!hasFlux) {
        throw new Error(
          `${describeImageError(err, "OpenAI 图像")}且未配置 Flux 回退（BFL_API_KEY / FAL_KEY）。` +
            `请为 OpenAI 充值，或配置 Flux / 改用 Gemini 图像模型。`
        );
      }
      console.warn(
        `[image] OpenAI 生成失败，自动回退 Flux：${describeImageError(err, "OpenAI 图像")}`
      );
    }
  }

  if (hasFlux) return fluxFallback(prompt, size, count);

  throw new Error(
    "图像生成不可用：未配置 OPENAI_API_KEY，且未配置 Flux（BFL_API_KEY / FAL_KEY）。请配置任一图像 Provider。"
  );
}
