export type GenerationMode = "test" | "production";

export type VeoGenerationType = "t2v" | "i2v";

export const TEST_DURATION_SEC = 3;
export const PRODUCTION_DURATION_MIN = 8;
export const PRODUCTION_DURATION_MAX = 12;
export const DEFAULT_PRODUCTION_DURATION_SEC = 8;

export function resolveDurationForMode(mode: GenerationMode): number {
  return mode === "test" ? TEST_DURATION_SEC : DEFAULT_PRODUCTION_DURATION_SEC;
}
