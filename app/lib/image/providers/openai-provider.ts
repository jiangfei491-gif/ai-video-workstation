import fs from "fs";
import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import { estimateCostUsd } from "@/app/lib/cost-ledger/pricing";
import type { GenerateImageInput, GenerateImageOutput, ImageProviderId } from "./types";
import { estimateProviderCostUsd } from "./pricing";

const PRIMARY: ImageProviderId = "gpt-image-2";
const FALLBACK: ImageProviderId = "gpt-image-1";

type ImageApiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

function readImageUsage(result: unknown): { inputTokens: number; outputTokens: number } {
  const usage = (result as { usage?: ImageApiUsage }).usage;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  return { inputTokens, outputTokens };
}

function resolveImageCostUsd(
  model: string,
  providerId: ImageProviderId,
  inputTokens: number,
  outputTokens: number
): number {
  if (inputTokens > 0 || outputTokens > 0) {
    return estimateCostUsd(model, inputTokens, outputTokens);
  }
  return estimateProviderCostUsd(providerId);
}

function mapImageItems(
  items: OpenAI.Images.ImagesResponse["data"],
  model: string,
  providerId: ImageProviderId,
  usedReferences: boolean,
  tier: GenerateImageOutput["tier"],
  usage: { inputTokens: number; outputTokens: number }
): GenerateImageOutput[] {
  if (!items || items.length === 0) throw new Error(`${model} 未返回图片`);
  const perItem = {
    inputTokens: Math.floor(usage.inputTokens / items.length),
    outputTokens: Math.floor(usage.outputTokens / items.length),
  };
  const costPerItem = resolveImageCostUsd(
    model,
    providerId,
    perItem.inputTokens,
    perItem.outputTokens
  );
  return items.map((item) => {
    const b64 = item.b64_json;
    if (!b64) throw new Error(`${model} 未返回 b64_json`);
    return {
      buffer: Buffer.from(b64, "base64"),
      model,
      source: providerId,
      usedReferences,
      providerId,
      tier,
      estimatedCostUsd: costPerItem,
      inputTokens: perItem.inputTokens,
      outputTokens: perItem.outputTokens,
    };
  });
}

async function generateTextOnly(
  openai: OpenAI,
  prompt: string,
  size: GenerateImageInput["size"],
  n: number,
  providerId: ImageProviderId
): Promise<GenerateImageOutput[]> {
  const model = providerId === "gpt-image-2" ? "gpt-image-2" : "gpt-image-1";
  const result = await openai.images.generate({ model, prompt, n, size });
  const usage = readImageUsage(result);
  return mapImageItems(
    result.data,
    model,
    providerId,
    false,
    providerId === "gpt-image-2" ? 3 : 1,
    usage
  );
}

export async function generateOpenAI(
  providerId: ImageProviderId,
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey });
  const count = Math.max(1, Math.min(4, input.count ?? 1));
  const refs = (input.refPaths ?? []).filter((p) => fs.existsSync(p));
  const models: ImageProviderId[] =
    providerId === "gpt-image-1" ? ["gpt-image-1"] : ["gpt-image-2", "gpt-image-1"];

  if (refs.length === 0) {
    let lastError: unknown;
    for (const pid of models) {
      try {
        return await generateTextOnly(openai, input.prompt, input.size, count, pid);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  let lastError: unknown;
  for (const pid of models) {
    try {
      const model = pid === "gpt-image-2" ? "gpt-image-2" : "gpt-image-1";
      const refPath = refs[0];
      const result = await openai.images.edit({
        model,
        image: fs.createReadStream(refPath),
        prompt: input.prompt,
        n: count,
        size: input.size,
      });
      const usage = readImageUsage(result);
      return mapImageItems(result.data, model, pid, true, 3, usage);
    } catch (err) {
      lastError = err;
    }
  }

  const augmented = `${input.prompt}\n\nMatch character face, outfit, and scene from reference images exactly.`;
  return generateTextOnly(openai, augmented, input.size, count, PRIMARY);
}
