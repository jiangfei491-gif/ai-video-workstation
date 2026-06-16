import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

const PRIMARY_MODEL = "gpt-image-2";
const FALLBACK_MODEL = "gpt-image-1";

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export type GenerateImageResult = {
  buffer: Buffer;
  model: string;
  source: "gpt-image-2" | "gpt-image-1";
};

export async function generateImageWithGptImage2(
  prompt: string,
  size: ImageSize = "1024x1536",
  n = 1
): Promise<GenerateImageResult[]> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey });
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;
  const count = Math.max(1, Math.min(8, n));

  for (const model of models) {
    try {
      const result = await openai.images.generate({
        model,
        prompt,
        n: count,
        size,
      });
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
