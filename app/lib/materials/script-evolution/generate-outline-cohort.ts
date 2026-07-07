import { randomUUID } from "crypto";
import type { DurationPlan } from "./duration-config";
import { buildMaterialUserPrompt } from "./material-context";
import { buildOutlineSystem } from "./outline-styles";
import { listAvailableProviders, mapPool, providerChat } from "./providers";
import type { OutlineCandidate, ScriptProviderId, ScriptStyleId } from "./types";
import { ALL_STYLE_IDS } from "./types";
import type { Material } from "../types";

const CONCURRENCY = 4;
const OUTLINES_PER_PROVIDER = 2;

function uniqueRandomStyles(count: number): ScriptStyleId[] {
  const pool = [...ALL_STYLE_IDS];
  const out: ScriptStyleId[] = [];
  for (let i = 0; i < count; i++) {
    if (pool.length === 0) pool.push(...ALL_STYLE_IDS);
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export async function generateOutlineCohort(
  material: Material,
  plan: DurationPlan,
  onProgress?: (done: number, total: number) => void
): Promise<OutlineCandidate[]> {
  const providers = listAvailableProviders();
  if (providers.length === 0) {
    throw new Error("未配置任何进化模型（至少需要 OPENAI_API_KEY 或 VEO_API_KEY）");
  }

  const jobs: { provider: ScriptProviderId; style: ScriptStyleId }[] = [];
  for (const provider of providers) {
    const styles = uniqueRandomStyles(OUTLINES_PER_PROVIDER);
    for (const style of styles) {
      jobs.push({ provider, style });
    }
  }

  const userPrompt = buildMaterialUserPrompt(material);
  let done = 0;

  const results = await mapPool(jobs, CONCURRENCY, async (job) => {
    try {
      const system = buildOutlineSystem(job.style, plan);
      const { text, model, provider } = await providerChat(job.provider, system, userPrompt, {
        maxTokens: 1200,
        phase: "outline-generate",
      });
      done += 1;
      onProgress?.(done, jobs.length);
      return {
        id: randomUUID(),
        provider,
        style: job.style,
        model,
        outline: text,
      } as OutlineCandidate;
    } catch (err) {
      done += 1;
      onProgress?.(done, jobs.length);
      console.error(`[script-evolution] 大纲生成失败 ${job.provider}/${job.style}`, err);
      return null;
    }
  });

  const outlines = results.filter((o): o is OutlineCandidate => o != null && Boolean(o.outline));
  if (outlines.length === 0) {
    throw new Error("所有模型大纲生成均失败，请检查 API 密钥与额度");
  }
  return outlines;
}
