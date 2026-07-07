export type ImageStyle =
  | "realistic"
  | "anime"
  | "cinematic"
  | "advertising"
  | "illustration";

export const IMAGE_STYLE_OPTIONS: { id: ImageStyle; label: string }[] = [
  { id: "realistic", label: "写实" },
  { id: "anime", label: "动漫" },
  { id: "cinematic", label: "电影感" },
  { id: "advertising", label: "广告风" },
  { id: "illustration", label: "插画" },
];

import {
  ASPECT_RATIO_OPTIONS,
  CLARITY_OPTIONS,
  resolveOutputDimensions,
  type AspectClarityFields,
  type AspectRatioPreset,
  type ClarityId,
} from "@/app/lib/generation-params";

export type ImageAspectRatio = AspectRatioPreset | string;
export type ImageClarity = ClarityId;
export type ImageCount = 1 | 2 | 4 | 8;

export const IMAGE_ASPECT_OPTIONS = ASPECT_RATIO_OPTIONS;
export const IMAGE_CLARITY_OPTIONS = CLARITY_OPTIONS;

export const IMAGE_COUNT_OPTIONS: ImageCount[] = [1, 2, 4, 8];

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: "photorealistic, highly detailed, natural lighting",
  anime: "anime style, vibrant colors, clean lines",
  cinematic: "cinematic composition, dramatic lighting, film still",
  advertising: "commercial advertising style, polished, professional",
  illustration: "digital illustration, artistic, stylized",
};

export function aspectToSize(
  ratio: ImageAspectRatio,
  clarity: ImageClarity,
  fields?: Partial<AspectClarityFields>
): "1024x1024" | "1024x1536" | "1536x1024" {
  return resolveOutputDimensions({
    aspectRatio: ratio,
    clarity,
    ...fields,
  }).openAiSize;
}

export function buildImagePrompt(
  topic: string,
  prompt: string,
  style: ImageStyle
): string {
  const base = prompt.trim() || topic.trim();
  return `${base}. ${STYLE_PROMPTS[style]}. No text, no watermark.`;
}

export function parseDimensions(size: string): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number);
  return { width: w ?? 1024, height: h ?? 1024 };
}
