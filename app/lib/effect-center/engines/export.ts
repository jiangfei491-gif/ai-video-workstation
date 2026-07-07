import type { TimelineClip, TimelineTransition } from "@/app/lib/auto-edit/edit-graph/types";
import type { EffectCenterExports, EffectPlan } from "../types";

export function buildEffectExports(params: {
  video: TimelineClip[];
  transitions: TimelineTransition[];
  plan: EffectPlan;
}): EffectCenterExports {
  const payload = {
    preset: params.plan.preset,
    rationale: params.plan.rationale,
    transitions: params.transitions.map((t) => ({
      id: t.id,
      afterClipId: t.afterClipId,
      type: t.type,
      durationMs: t.durationMs,
      rationale: t.rationale,
    })),
    clipEffects: params.video
      .filter((c) => c.effects?.length)
      .map((c) => ({
        clipId: c.id,
        label: c.label,
        effects: c.effects,
      })),
  };
  return { json: JSON.stringify(payload, null, 2) };
}
