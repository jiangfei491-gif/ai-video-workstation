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

export type ImageAspectRatio = "1:1" | "9:16" | "16:9";
export type ImageClarity = "standard" | "hd" | "uhd";
export type ImageCount = 1 | 2 | 4 | 8;

export const IMAGE_ASPECT_OPTIONS: { id: ImageAspectRatio; label: string }[] = [
  { id: "1:1", label: "正方形 1:1" },
  { id: "9:16", label: "竖屏 9:16" },
  { id: "16:9", label: "横屏 16:9" },
];

export { CLARITY_OPTIONS as IMAGE_CLARITY_OPTIONS } from "@/app/lib/generation-params";

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
  clarity: ImageClarity
): "1024x1024" | "1024x1536" | "1536x1024" {
  if (ratio === "1:1") return clarity === "uhd" ? "1024x1024" : "1024x1024";
  if (ratio === "16:9") return clarity === "standard" ? "1536x1024" : "1536x1024";
  return clarity === "standard" ? "1024x1536" : "1024x1536";
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
