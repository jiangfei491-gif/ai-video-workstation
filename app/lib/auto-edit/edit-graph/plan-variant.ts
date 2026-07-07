import { extractShotDecisions } from "@/app/lib/auto-edit/engines/ai-decision";
import type { EditPlan, EditSequence } from "@/app/lib/auto-edit/types";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit/workbench-bridge";
import { sequenceToTimeline } from "./timeline-bridge";
import type { EditPlanVariant } from "./types";

export function createPlanVariantFromApi(
  plan: EditPlan,
  sequence: EditSequence,
  input: NonNullable<ReturnType<typeof buildEditInputFromWorkbench>>,
  name: string
): EditPlanVariant {
  const timeline = sequenceToTimeline(sequence, input);
  const decisions = extractShotDecisions(plan, sequence);
  const perShot: Record<string, string> = {};
  for (const d of decisions) {
    perShot[d.key] = d.reason;
  }

  const transitionRationale = plan.transitionRationale ?? {};
  const transitions = timeline.transitions.map((tr) => {
    const videoClip = timeline.video.find((v) => v.id === tr.afterClipId);
    const fromKey = videoClip?.sourceKey;
    const toIdx = timeline.video.findIndex((v) => v.id === tr.afterClipId);
    const toKey =
      toIdx >= 0 && toIdx < timeline.video.length - 1
        ? timeline.video[toIdx + 1]?.sourceKey
        : undefined;
    const rationale =
      tr.rationale ??
      (fromKey && toKey ? transitionRationale[`${fromKey}->${toKey}`] : undefined) ??
      transitionRationale[tr.afterClipId];
    return rationale ? { ...tr, rationale } : tr;
  });

  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: new Date().toISOString(),
    pacingProfile: plan.pacingProfile,
    timeline: { ...timeline, transitions },
    sequence: plan,
    rationale: {
      summary: plan.aiNotes ?? [],
      perShot,
      perTransition: transitionRationale,
    },
    model: plan.model,
    usage: plan.usage,
  };
}
