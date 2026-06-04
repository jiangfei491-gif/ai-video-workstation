import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

const PRIMARY_MODEL = "gpt-image-2";
const FALLBACK_MODEL = "gpt-image-1";

export type GenerateImageResult = {
  buffer: Buffer;
  model: string;
  source: "gpt-image-2" | "gpt-image-1";
};

export async function generateImageWithGptImage2(
  prompt: string,
  size: "1024x1536" | "1024x1024" = "1024x1536"
): Promise<GenerateImageResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey });
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (const model of models) {
    try {
      const result = await openai.images.generate({
        model,
        prompt,
        n: 1,
        size,
      });
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error(`${model} 未返回 b64_json`);
      return {
        buffer: Buffer.from(b64, "base64"),
        model,
        source: model === PRIMARY_MODEL ? "gpt-image-2" : "gpt-image-1",
      };
    } catch (err) {
      lastError = err;
      if (model === FALLBACK_MODEL) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
