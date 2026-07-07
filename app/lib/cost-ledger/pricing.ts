/** USD per 1M tokens — 客户端/服务端共用 */
export const MODEL_PRICING: Record<
  string,
  { inputPer1M: number; outputPer1M: number }
> = {
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  /** OpenAI Images API — 按 usage token 粗算 */
  "gpt-image-1": { inputPer1M: 10.0, outputPer1M: 40.0 },
  "gpt-image-2": { inputPer1M: 10.0, outputPer1M: 40.0 },
};

function normalizeModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (m.includes("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (m.includes("gpt-4.1")) return "gpt-4.1";
  if (m.includes("gpt-4o")) return "gpt-4o";
  return model;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const key = normalizeModel(model);
  const pricing = MODEL_PRICING[key] ?? MODEL_PRICING["gpt-4.1"];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}
