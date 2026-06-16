export type ClarityId = "standard" | "hd" | "uhd";
export type SeedMode = "random" | "fixed";

export const CLARITY_OPTIONS: { id: ClarityId; label: string }[] = [
  { id: "standard", label: "720P 标清" },
  { id: "hd", label: "1080P 高清" },
  { id: "uhd", label: "4K 超清" },
];

export const DEFAULT_FIXED_SEED = 123456789;

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
