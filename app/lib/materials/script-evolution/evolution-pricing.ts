import type { ScriptProviderId } from "./types";

/** USD per 1M tokens（粗算，供进化成本统计） */
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-3-5-sonnet": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "deepseek-chat": { inputPer1M: 0.28, outputPer1M: 0.42 },
};

const PROVIDER_DEFAULT: Record<ScriptProviderId, string> = {
  gpt: "gpt-4.1",
  gemini: "gemini-2.5-flash",
  claude: "claude-sonnet-4-6",
  deepseek: "deepseek-chat",
};

function normalizeModelKey(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("deepseek")) return "deepseek-chat";
  if (m.includes("claude")) return m.includes("sonnet") ? "claude-sonnet-4-6" : "claude-sonnet-4-6";
  if (m.includes("gemini-2.5")) return "gemini-2.5-flash";
  if (m.includes("gemini")) return "gemini-2.5-flash";
  if (m.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (m.includes("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (m.includes("gpt-4.1")) return "gpt-4.1";
  if (m.includes("gpt-4o")) return "gpt-4o";
  return model;
}

export function estimateEvolutionCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const key = normalizeModelKey(model);
  const pricing = PRICING[key] ?? PRICING[PROVIDER_DEFAULT.gpt];
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

export function usdToCny(usd: number): number {
  return Math.round(usd * 7.2 * 100) / 100;
}
