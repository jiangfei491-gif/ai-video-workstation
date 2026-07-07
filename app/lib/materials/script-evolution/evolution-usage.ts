import { estimateEvolutionCostUsd } from "./evolution-pricing";
import type { ScriptProviderId } from "./types";
import { recordTokenCost, guessProvider } from "@/app/lib/cost-ledger/unified";

export type EvolutionApiCall = {
  phase: string;
  provider: ScriptProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
};

export type EvolutionUsageSummary = {
  calls: EvolutionApiCall[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostCny: number;
  totalDurationMs: number;
};

let activeCalls: EvolutionApiCall[] | null = null;

export function beginEvolutionUsage(): void {
  activeCalls = [];
}

export function recordEvolutionApiCall(
  partial: Omit<EvolutionApiCall, "costUsd"> & { costUsd?: number }
): void {
  if (!activeCalls) return;
  const costUsd =
    partial.costUsd ??
    estimateEvolutionCostUsd(partial.model, partial.inputTokens, partial.outputTokens);
  activeCalls.push({ ...partial, costUsd });
  // 汇入全平台成本总账
  recordTokenCost("内容中心", "脚本进化", guessProvider(partial.model), partial.model, partial.inputTokens, partial.outputTokens, { costUsd });
}

export function finishEvolutionUsage(): EvolutionUsageSummary {
  const calls = activeCalls ?? [];
  activeCalls = null;
  const totalInputTokens = calls.reduce((s, c) => s + c.inputTokens, 0);
  const totalOutputTokens = calls.reduce((s, c) => s + c.outputTokens, 0);
  const totalCostUsd = calls.reduce((s, c) => s + c.costUsd, 0);
  const totalDurationMs = calls.reduce((s, c) => s + c.durationMs, 0);
  return {
    calls,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
    totalCostCny: Math.round(totalCostUsd * 7.2 * 100) / 100,
    totalDurationMs,
  };
}
