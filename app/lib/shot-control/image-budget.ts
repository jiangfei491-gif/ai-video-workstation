/** 图片预算模式 — 只控制生图成本，不控制叙事镜头数（Phase 2+ 由 GPT 自然拆镜） */

export type ImageBudgetMode = "economy" | "standard" | "premium" | "custom";

export const IMAGE_BUDGET_MODE_LABELS: Record<
  ImageBudgetMode,
  { label: string; hint: string }
> = {
  economy: { label: "省钱", hint: "约 25–30 张 / 8 分钟" },
  standard: { label: "标准", hint: "约 40–50 张 / 8 分钟" },
  premium: { label: "高质量", hint: "约 60–80 张 / 8 分钟" },
  custom: { label: "自定义", hint: "手动指定图片张数" },
};

/** 8 分钟基准下的默认图片预算（各模式取区间中值） */
const BASE_DURATION_SEC = 8 * 60;
const BASE_BUDGET_BY_MODE: Record<Exclude<ImageBudgetMode, "custom">, number> = {
  economy: 28,
  standard: 45,
  premium: 70,
};

export const MIN_IMAGE_BUDGET = 5;
export const MAX_IMAGE_BUDGET = 200;

export function clampImageBudget(value: number): number {
  const n = Math.floor(value) || MIN_IMAGE_BUDGET;
  return Math.max(MIN_IMAGE_BUDGET, Math.min(MAX_IMAGE_BUDGET, n));
}

/** 按时长成比例缩放 8 分钟基准预算 */
export function resolveImageBudget(params: {
  targetDurationSec: number;
  mode: ImageBudgetMode;
  customBudget?: number;
}): number {
  const scale = Math.max(0.25, params.targetDurationSec / BASE_DURATION_SEC);
  if (params.mode === "custom") {
    return clampImageBudget(params.customBudget ?? BASE_BUDGET_BY_MODE.standard);
  }
  const base = BASE_BUDGET_BY_MODE[params.mode];
  return clampImageBudget(Math.round(base * scale));
}

/**
 * @deprecated Phase 2 起 t2i 不再使用。仅保留供历史脚本/测试引用。
 */
export function interimStoryboardShotCount(imageBudget: number): number {
  return Math.max(20, Math.round(imageBudget * 2.5));
}

const VALID_MODES = new Set<ImageBudgetMode>(["economy", "standard", "premium", "custom"]);

export function isImageBudgetMode(value: unknown): value is ImageBudgetMode {
  return typeof value === "string" && VALID_MODES.has(value as ImageBudgetMode);
}

/** 补齐/校正图片预算字段；旧会话无 imageBudget 时按时长+模式重算 */
export function normalizeImageBudgetFields(
  state: {
    pipelineMode?: import("@/app/lib/pipeline-mode").PipelineMode;
    targetDurationMinutes?: number;
    imageBudget?: number;
    imageBudgetMode?: unknown;
  },
  opts?: { hadPersistedBudget?: boolean }
): { imageBudget: number; imageBudgetMode: ImageBudgetMode } {
  const mode: ImageBudgetMode = isImageBudgetMode(state.imageBudgetMode)
    ? state.imageBudgetMode
    : "standard";
  const targetSec = Math.round((state.targetDurationMinutes ?? 1) * 60);
  const hadPersisted =
    opts?.hadPersistedBudget === true &&
    typeof state.imageBudget === "number" &&
    Number.isFinite(state.imageBudget);
  const imageBudget = hadPersisted
    ? clampImageBudget(state.imageBudget!)
    : resolveImageBudget({
        targetDurationSec: targetSec,
        mode,
        customBudget: mode === "custom" ? state.imageBudget : undefined,
      });
  return { imageBudget, imageBudgetMode: mode };
}
