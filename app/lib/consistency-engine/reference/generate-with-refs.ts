import {
  generateTier1Draft,
  generateTier3Premium,
  generateWithProvider,
} from "@/app/lib/image/providers/router";
import type { GenerateImageInput, ImageProviderId } from "@/app/lib/image/providers/types";

/** @deprecated 使用 image/providers/router；保留兼容旧 pipeline */
export async function generateImageWithReferences(
  prompt: string,
  refPaths: string[],
  size: GenerateImageInput["size"] = "1024x1536",
  n = 1
): Promise<
  {
    buffer: Buffer;
    model: string;
    source: string;
    usedReferences: boolean;
  }[]
> {
  const results = await generateTier3Premium({
    prompt,
    refPaths,
    size,
    count: n,
  });
  return results.map((r) => ({
    buffer: r.buffer,
    model: r.model,
    source: r.source,
    usedReferences: r.usedReferences,
  }));
}

export { generateTier1Draft, generateTier3Premium, generateWithProvider };
export type { ImageProviderId, GenerateImageInput };
