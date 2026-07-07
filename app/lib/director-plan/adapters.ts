import type { BuildEditInput, EditPlan, TransitionType } from "@/app/lib/auto-edit/types";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type {
  ClipIntent,
  DirectorPlan,
  SubtitleIntent,
  TransitionIntent,
} from "./types";

function transitionFromEdit(
  fromKey: string,
  plan: EditPlan
): TransitionIntent | undefined {
  const t = plan.transitions.find((x) => x.fromKey === fromKey);
  if (!t) return undefined;
  return {
    type: t.type,
    durationMs: t.durationMs,
    rationale: plan.transitionRationale?.[`${t.fromKey}->${t.toKey}`],
  };
}

/** EditPlan（旧 AI 导演输出）→ DirectorPlan */
export function editPlanToDirectorPlan(
  plan: EditPlan,
  input: BuildEditInput,
  title: string
): DirectorPlan {
  let cursor = 0;
  const clips: ClipIntent[] = plan.playOrder.map((key) => {
    const clip = plan.clips[key];
    const startSec = cursor;
    cursor += clip.durationSec;
    return {
      id: key,
      shotIndex: clip.shotIndex,
      assetId: key,
      assetUrl: clip.mediaUrl,
      label: clip.label,
      startSec,
      durationSec: clip.durationSec,
      transitionAfter: transitionFromEdit(key, plan),
      rationale: plan.clipRationale?.[key]?.reason,
      tags: plan.clipRationale?.[key]?.tags,
    };
  });

  const subtitles: SubtitleIntent[] = input.storyboard
    .map((shot, shotIndex) => {
      const narr = shot.narration?.trim();
      if (!narr) return null;
      const clip = clips.find((c) => c.shotIndex === shotIndex);
      if (!clip) return null;
      return {
        id: `sub-${shotIndex}`,
        text: narr,
        startSec: clip.startSec,
        durationSec: clip.durationSec,
        shotIndex,
      } satisfies SubtitleIntent;
    })
    .filter(Boolean) as SubtitleIntent[];

  return {
    version: 1,
    id: `plan-${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    fps: input.fps,
    aspectRatio: input.aspectRatio,
    pacingProfile: plan.pacingProfile,
    clips,
    subtitles,
    meta: {
      aiNotes: plan.aiNotes,
      sectionPacing: plan.sectionPacing,
      model: plan.model,
      usage: plan.usage,
    },
  };
}

/** EditGraph → DirectorPlan（过渡期 adapter） */
export function editGraphToDirectorPlan(
  graph: EditGraph,
  title: string
): DirectorPlan {
  const clips: ClipIntent[] = graph.timeline.video.map((c) => {
    const tr = graph.timeline.transitions.find((t) => t.afterClipId === c.id);
    const transitionAfter: TransitionIntent | undefined = tr
      ? {
          type: tr.type as TransitionType,
          durationMs: tr.durationMs,
          rationale: tr.rationale,
        }
      : undefined;
    return {
      id: c.id,
      shotIndex: c.video?.shotIndex ?? 0,
      assetId: c.mediaRefId ?? c.id,
      assetUrl: graph.mediaPool.find((m) => m.id === c.mediaRefId)?.url,
      label: c.label,
      startSec: c.startSec,
      durationSec: c.durationSec,
      transitionAfter,
    };
  });

  const subtitles: SubtitleIntent[] = graph.timeline.subtitle.map((c) => ({
    id: c.id,
    text: c.subtitle?.text ?? c.label,
    startSec: c.startSec,
    durationSec: c.durationSec,
    style: c.subtitle?.style,
  }));

  const voiceClip = graph.timeline.voice[0];
  const musicClip = graph.timeline.music[0];

  return {
    version: 1,
    id: `plan-${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    fps: graph.timeline.fps,
    aspectRatio: graph.timeline.aspectRatio,
    pacingProfile: graph.pacingProfile,
    clips,
    subtitles,
    voice: voiceClip
      ? {
          assetId: voiceClip.mediaRefId ?? voiceClip.id,
          assetUrl: graph.mediaPool.find((m) => m.id === voiceClip.mediaRefId)?.url,
          volume: voiceClip.audio?.volume,
        }
      : undefined,
    music: musicClip
      ? {
          assetId: musicClip.mediaRefId ?? musicClip.id,
          assetUrl: graph.mediaPool.find((m) => m.id === musicClip.mediaRefId)?.url,
          startSec: musicClip.startSec,
          durationSec: musicClip.durationSec,
          volume: musicClip.audio?.volume,
        }
      : undefined,
    meta: {
      aiNotes: graph.plans.find((p) => p.id === graph.activePlanId)?.rationale.summary ?? [],
    },
  };
}
