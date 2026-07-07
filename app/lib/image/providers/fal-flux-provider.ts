import type { GenerateImageInput, GenerateImageOutput } from "./types";
import { estimateProviderCostUsd } from "./pricing";

function readFalKey(): string | null {
  const raw = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!raw) return null;
  const t = raw.trim().replace(/^['"]|['"]$/g, "");
  return t.length > 0 ? t : null;
}

function sizeToFal(size: GenerateImageInput["size"]): string {
  if (size === "1536x1024") return "landscape_16_9";
  if (size === "1024x1024") return "square_hd";
  return "portrait_16_9";
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载 FLUX 图片失败 [${res.status}]`);
  return Buffer.from(await res.arrayBuffer());
}

/** Tier 1 — FAL FLUX Schnell / Dev */
export async function generateFalFlux(
  variant: "flux-schnell" | "flux-dev",
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  const apiKey = readFalKey();
  if (!apiKey) throw new Error("未配置 FAL_KEY（FLUX 批量生图需要）");

  const endpoint =
    variant === "flux-schnell"
      ? "https://fal.run/fal-ai/flux/schnell"
      : "https://fal.run/fal-ai/flux/dev";

  const count = Math.max(1, Math.min(4, input.count ?? 1));
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      num_images: count,
      image_size: sizeToFal(input.size),
      enable_safety_checker: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FLUX ${variant} 失败 [${res.status}]: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    images?: { url: string; width?: number; height?: number }[];
  };
  const images = data.images ?? [];
  if (images.length === 0) throw new Error(`FLUX ${variant} 未返回图片`);

  const outputs: GenerateImageOutput[] = [];
  for (const img of images) {
    outputs.push({
      buffer: await downloadBuffer(img.url),
      model: variant,
      source: variant,
      usedReferences: false,
      providerId: variant,
      tier: 1,
      estimatedCostUsd: estimateProviderCostUsd(variant),
    });
  }
  return outputs;
}

export function isFalConfigured(): boolean {
  return !!readFalKey();
}
