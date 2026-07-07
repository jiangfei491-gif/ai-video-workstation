import type { TransitionType } from "../types";
import type { EditTimeline, TimelineTransition } from "./types";

export function updateTimelineTransition(
  timeline: EditTimeline,
  afterClipId: string,
  patch: { type?: TransitionType; durationMs?: number; rationale?: string }
): EditTimeline {
  const idx = timeline.transitions.findIndex((t) => t.afterClipId === afterClipId);
  const type = patch.type ?? timeline.transitions[idx]?.type ?? "cut";
  const durationMs =
    type === "cut" ? 0 : (patch.durationMs ?? timeline.transitions[idx]?.durationMs ?? 400);

  let transitions: TimelineTransition[];
  if (idx >= 0) {
    transitions = timeline.transitions.map((tr, i) =>
      i === idx ? { ...tr, type, durationMs, ...patch } : tr
    );
  } else {
    transitions = [
      ...timeline.transitions,
      {
        id: `tr-${afterClipId}`,
        afterClipId,
        type,
        durationMs,
        rationale: patch.rationale,
      },
    ];
  }

  return { ...timeline, transitions };
}

/** 将全部 clip 间接缝应用引擎默认转场 */
export function applyDefaultTransitionsToTimeline(
  timeline: EditTimeline,
  defaults: { type: TransitionType; durationMs: number }
): EditTimeline {
  const videoIds = [...timeline.video]
    .sort((a, b) => a.startSec - b.startSec)
    .map((c) => c.id);

  const byAfter = new Map(timeline.transitions.map((t) => [t.afterClipId, t]));
  const transitions: TimelineTransition[] = [];

  for (let i = 0; i < videoIds.length - 1; i++) {
    const afterClipId = videoIds[i];
    const prev = byAfter.get(afterClipId);
    const type = defaults.type;
    const durationMs = type === "cut" ? 0 : defaults.durationMs;
    transitions.push({
      id: prev?.id ?? `tr-${afterClipId}`,
      afterClipId,
      type,
      durationMs,
      rationale: prev?.rationale,
    });
  }

  return { ...timeline, transitions };
}
