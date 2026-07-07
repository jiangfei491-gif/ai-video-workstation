import { randomUUID } from "crypto";
import { buildMaterialUserPrompt } from "./material-context";
import { listAvailableProviders, mapPool, providerChat } from "./providers";
import { buildGeneratorSystem } from "./styles";
import type { ScriptCandidate, ScriptProviderId, ScriptStyleId } from "./types";
import { EVOLUTION_STYLE_IDS } from "./types";
import type { Material } from "../types";

const CONCURRENCY = 4;

export async function generateScriptCohort(
  material: Material,
  onProgress?: (done: number, total: number) => void
): Promise<ScriptCandidate[]> {
  const providers = listAvailableProviders();
  if (providers.length === 0) {
    throw new Error("未配置任何进化模型（至少需要 OPENAI_API_KEY 或 VEO_API_KEY）");
  }

  const styles = EVOLUTION_STYLE_IDS;
  const jobs: { provider: ScriptProviderId; style: ScriptStyleId }[] = [];
  for (const provider of providers) {
    for (const style of styles) {
      jobs.push({ provider, style });
    }
  }

  const userPrompt = buildMaterialUserPrompt(material);
  let done = 0;

  const results = await mapPool(jobs, CONCURRENCY, async (job) => {
    try {
      const system = buildGeneratorSystem(job.style);
      const { text, model, provider } = await providerChat(job.provider, system, userPrompt, {
        maxTokens: 1800,
      });
      done += 1;
      onProgress?.(done, jobs.length);
      return {
        id: randomUUID(),
        provider,
        style: job.style,
        model,
        script: text,
      } satisfies ScriptCandidate;
    } catch (err) {
      done += 1;
      onProgress?.(done, jobs.length);
      console.error(`[script-evolution] 生成失败 ${job.provider}/${job.style}`, err);
      return null;
    }
  });

  const candidates = results.filter((c) => c !== null && Boolean(c.script)) as ScriptCandidate[];
  if (candidates.length === 0) {
    throw new Error("所有模型生成均失败，请检查 API 密钥与额度");
  }
  return candidates;
}
