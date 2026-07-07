/** 生图 Provider ID */
export type ImageProviderId =
  | "flux-schnell"
  | "flux-dev"
  | "gpt-image-2"
  | "gpt-image-1"
  | "imagen-3";

export type ImageTier = 1 | 2 | 3 | 4;

/** 质量模式：极速 / 标准 / 高级 / 旗舰 */
export type QualityMode = "fast" | "standard" | "advanced" | "flagship";

export type ImageSizeKey = "1024x1536" | "1536x1024" | "1024x1024";

export type GenerateImageInput = {
  prompt: string;
  refPaths?: string[];
  size: ImageSizeKey;
  /** FLUX 等支持任意尺寸时使用；优先于 size 映射 */
  dimensions?: { width: number; height: number };
  count?: number;
  /** tier3 精修时可传入 tier1 成图作构图参考 */
  compositionRefPath?: string;
};

export type GenerateImageOutput = {
  buffer: Buffer;
  model: string;
  source: string;
  usedReferences: boolean;
  providerId: ImageProviderId;
  tier: ImageTier;
  estimatedCostUsd: number;
  /** OpenAI Images API 返回的真实 token（有则优先用于计费） */
  inputTokens?: number;
  outputTokens?: number;
};

export type ProviderAvailability = {
  flux: boolean;
  bfl: boolean;
  fal: boolean;
  openai: boolean;
  imagen: boolean;
};
