import type { TimelineClip, TimelineTransition } from "@/app/lib/auto-edit/edit-graph/types";
import type { EffectPlan } from "../types";

/** Rule Engine：将 Effect Plan 写入 timeline.transitions 与 video.effects */
export function applyEffectPlanToTimeline(
  videoClips: TimelineClip[],
  plan: EffectPlan
): { video: TimelineClip[]; transitions: TimelineTransition[] } {
  const effectsByClip = new Map<string, EffectPlan["clipEffects"]>();
  for (const eff of plan.clipEffects) {
    const list = effectsByClip.get(eff.clipId) ?? [];
    list.push(eff);
    effectsByClip.set(eff.clipId, list);
  }

  const video = videoClips.map((clip) => {
    const recs = effectsByClip.get(clip.id);
    if (!recs?.length) {
      return { ...clip, effects: clip.effects ?? undefined };
    }
    const effects = recs.map((e) => ({
      kind: e.kind,
      startSec: e.startSec,
      durationSec: e.durationSec,
      intensity: e.intensity,
    }));
    return { ...clip, effects };
  });

  const transitions: TimelineTransition[] = plan.transitions.map((t) => ({
    id: `tr-${t.afterClipId}`,
    afterClipId: t.afterClipId,
    type: t.type,
    durationMs: t.durationMs,
    rationale: t.rationale,
  }));

  return { video, transitions };
}
