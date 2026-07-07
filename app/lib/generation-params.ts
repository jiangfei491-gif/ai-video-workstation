import type { ImageSizeKey } from "@/app/lib/image/providers/types";

export type SeedMode = "random" | "fixed";

export type AspectRatioPreset =
  | "9:16"
  | "16:9"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9"
  | "2:3"
  | "3:2"
  | "5:4"
  | "4:5"
  | "custom";

export type ClarityId =
  | "480p"
  | "720p"
  | "1080p"
  | "2k"
  | "4k"
  | "8k"
  | "custom";

/** @deprecated 兼容旧持久化数据 */
export type LegacyClarityId = "standard" | "hd" | "uhd";

export const ASPECT_RATIO_OPTIONS: { id: AspectRatioPreset; label: string }[] = [
  { id: "9:16", label: "竖屏 9:16" },
  { id: "16:9", label: "横屏 16:9" },
  { id: "1:1", label: "正方形 1:1" },
  { id: "4:3", label: "传统横 4:3" },
  { id: "3:4", label: "传统竖 3:4" },
  { id: "21:9", label: "超宽 21:9" },
  { id: "3:2", label: "写真横 3:2" },
  { id: "2:3", label: "写真竖 2:3" },
  { id: "5:4", label: "中画幅 5:4" },
  { id: "4:5", label: "中画幅竖 4:5" },
  { id: "custom", label: "自定义" },
];

export const CLARITY_OPTIONS: { id: ClarityId; label: string }[] = [
  { id: "480p", label: "480P 标清" },
  { id: "720p", label: "720P 高清" },
  { id: "1080p", label: "1080P 全高清" },
  { id: "2k", label: "2K" },
  { id: "4k", label: "4K 超清" },
  { id: "8k", label: "8K" },
  { id: "custom", label: "自定义" },
];

const CLARITY_LONG_EDGE: Record<Exclude<ClarityId, "custom">, number> = {
  "480p": 864,
  "720p": 1280,
  "1080p": 1920,
  "2k": 2560,
  "4k": 3840,
  "8k": 7680,
};

const LEGACY_CLARITY: Record<LegacyClarityId, ClarityId> = {
  standard: "720p",
  hd: "1080p",
  uhd: "4k",
};

export const DEFAULT_FIXED_SEED = 123456789;

export type AspectClarityFields = {
  aspectRatio: AspectRatioPreset | string;
  customAspectRatio?: string;
  clarity: ClarityId | LegacyClarityId | string;
  customClarityWidth?: number;
  customClarityHeight?: number;
};

export function normalizeClarity(
  clarity: AspectClarityFields["clarity"] | undefined
): ClarityId {
  if (!clarity) return "1080p";
  if (clarity in LEGACY_CLARITY) {
    return LEGACY_CLARITY[clarity as LegacyClarityId];
  }
  if (CLARITY_OPTIONS.some((c) => c.id === clarity)) {
    return clarity as ClarityId;
  }
  return "1080p";
}

export function normalizeAspectRatio(
  aspectRatio: string | undefined
): AspectRatioPreset | string {
  if (!aspectRatio) return "9:16";
  if (ASPECT_RATIO_OPTIONS.some((a) => a.id === aspectRatio)) {
    return aspectRatio as AspectRatioPreset;
  }
  if (/^\d+:\d+$/.test(aspectRatio)) return "custom";
  return "9:16";
}

export function parseAspectRatioString(ratio: string): { w: number; h: number } {
  const [a, b] = ratio.split(":").map((n) => Math.max(1, Math.floor(Number(n) || 0)));
  if (!a || !b) return { w: 9, h: 16 };
  return { w: a, h: b };
}

export function resolveEffectiveAspectRatio(fields: AspectClarityFields): string {
  const preset = normalizeAspectRatio(fields.aspectRatio);
  if (preset === "custom") {
    const custom = fields.customAspectRatio?.trim();
    if (custom && /^\d+:\d+$/.test(custom)) return custom;
    return "9:16";
  }
  return preset;
}

function roundToMultiple(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

/** BFL/Flux 要求 32 对齐；OpenAI 亦兼容 */
function clampDimension(value: number): number {
  return roundToMultiple(Math.min(8192, Math.max(256, value)), 32);
}

export function snapToOpenAiSize(width: number, height: number): ImageSizeKey {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) return "1024x1024";
  if (ratio > 1) return "1536x1024";
  return "1024x1536";
}

export function resolveOutputDimensions(fields: AspectClarityFields): {
  width: number;
  height: number;
  aspectLabel: string;
  openAiSize: ImageSizeKey;
} {
  const clarity = normalizeClarity(fields.clarity);
  const aspectLabel = resolveEffectiveAspectRatio(fields);

  if (clarity === "custom") {
    const width = clampDimension(fields.customClarityWidth ?? 1024);
    const height = clampDimension(fields.customClarityHeight ?? 1024);
    return {
      width,
      height,
      aspectLabel: `${width}x${height}`,
      openAiSize: snapToOpenAiSize(width, height),
    };
  }

  const longEdge = CLARITY_LONG_EDGE[clarity];
  const { w, h } = parseAspectRatioString(aspectLabel);
  let width: number;
  let height: number;

  if (w >= h) {
    width = clampDimension(longEdge);
    height = clampDimension((longEdge * h) / w);
  } else {
    height = clampDimension(longEdge);
    width = clampDimension((longEdge * w) / h);
  }

  return {
    width,
    height,
    aspectLabel,
    openAiSize: snapToOpenAiSize(width, height),
  };
}

/** Veo 仅支持 9:16 / 16:9，自定义比例取最近竖/横 */
export function veoAspectRatio(fields: AspectClarityFields): "9:16" | "16:9" {
  const { w, h } = parseAspectRatioString(resolveEffectiveAspectRatio(fields));
  return w >= h ? "16:9" : "9:16";
}

export function aspectRatioCss(ratio: string, customAspectRatio?: string): string {
  const effective =
    ratio === "custom"
      ? customAspectRatio && /^\d+:\d+$/.test(customAspectRatio)
        ? customAspectRatio
        : "9:16"
      : ratio;
  const { w, h } = parseAspectRatioString(effective);
  return `${w} / ${h}`;
}

export function normalizeAspectClarityFields<T extends AspectClarityFields>(
  state: T
): T & {
  aspectRatio: AspectRatioPreset | string;
  clarity: ClarityId;
  customAspectRatio?: string;
  customClarityWidth?: number;
  customClarityHeight?: number;
} {
  const aspectRatio = normalizeAspectRatio(state.aspectRatio);
  const clarity = normalizeClarity(state.clarity);
  return {
    ...state,
    aspectRatio,
    clarity,
    customAspectRatio:
      aspectRatio === "custom" ? state.customAspectRatio?.trim() || "9:16" : state.customAspectRatio,
    customClarityWidth: state.customClarityWidth,
    customClarityHeight: state.customClarityHeight,
  };
}

export function randomGenerationSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

/** Seed sent to APIs: fixed uses user value; random omits so server picks. */
export function resolveRequestSeed(
  seedMode: SeedMode,
  seed: number | null
): number | undefined {
  if (seedMode === "fixed") return seed ?? DEFAULT_FIXED_SEED;
  return undefined;
}

export function inferSeedMode(
  seedMode: SeedMode | undefined,
  seed: number | null | undefined
): SeedMode {
  if (seedMode === "random" || seedMode === "fixed") return seedMode;
  return seed != null ? "fixed" : "random";
}

export function normalizeSeedFields<T extends {
  seedMode?: SeedMode;
  seed: number | null;
}>(state: T): T & { seedMode: SeedMode; seed: number | null } {
  const seedMode = inferSeedMode(state.seedMode, state.seed);
  return {
    ...state,
    seedMode,
    seed:
      seedMode === "fixed" ? (state.seed ?? DEFAULT_FIXED_SEED) : null,
  };
}

/** Value stored on history entries alongside seedMode. */
export function resolveHistorySeed(
  seedMode: SeedMode,
  seed: number | null,
  lastUsedSeed?: number | null
): number | null {
  if (seedMode === "fixed") return seed ?? DEFAULT_FIXED_SEED;
  return lastUsedSeed ?? null;
}
