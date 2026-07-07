import { randomUUID } from "crypto";
import type { DurationPlan } from "./duration-config";
import { buildMaterialUserPrompt } from "./material-context";
import { buildExpandSystem } from "./outline-styles";
import { providerChat } from "./providers";
import type { ModelOutlinePick } from "./pick-top-models";
import type { ScriptCandidate } from "./types";
import type { Material } from "../types";

export async function expandOutlineToScript(
  material: Material,
  plan: DurationPlan,
  pick: ModelOutlinePick
): Promise<ScriptCandidate> {
  const { outline } = pick;
  const system = buildExpandSystem(outline.style, plan);
  const user = `【素材】
${buildMaterialUserPrompt(material)}

【待扩写大纲】
${outline.outline}`;

  const maxTokens = Math.min(16384, Math.max(2500, Math.round(plan.targetWordCount * 2.2)));
  const { text, model, provider } = await providerChat(outline.provider, system, user, {
    maxTokens,
    phase: "expand",
  });

  return {
    id: randomUUID(),
    provider,
    style: outline.style,
    model,
    script: text,
    outline: outline.outline,
    outlineId: outline.id,
  };
}
