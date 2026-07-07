import type { BuildEditInput, EditSequence, EditTransition } from "../types";
import type { EditTimeline, TimelineClip, TimelineTransition } from "./types";
import type { ScriptSegment } from "./types";
import {
  attachTimelineToScriptMap,
  buildShotFirstScriptMap,
} from "./build-script-map";
import { buildVoiceAndPhraseSubtitles, buildShotNarrationMap } from "../audio/align-voice-subtitle";

function transitionsFromSequence(
  sequence: EditSequence,
  videoClips: TimelineClip[]
): TimelineTransition[] {
  const byKey = new Map(videoClips.map((c) => [c.sourceKey, c]));
  const out: TimelineTransition[] = [];

  for (let i = 0; i < sequence.playOrder.length - 1; i++) {
    const fromKey = sequence.playOrder[i];
    const toKey = sequence.playOrder[i + 1];
    const fromClip = byKey.get(fromKey);
    const tr =
      sequence.transitions.find((t) => t.fromKey === fromKey && t.toKey === toKey) ??
      ({ fromKey, toKey, type: "cut" as const, durationMs: 0 } satisfies EditTransition);

    if (fromClip) {
      out.push({
        id: `tr-${fromKey}-${toKey}`,
        afterClipId: fromClip.id,
        type: tr.type,
        durationMs: tr.durationMs,
      });
    }
  }
  return out;
}

function voiceAndSubtitleFromInput(
  input: BuildEditInput,
  videoClips: TimelineClip[]
): { voice: TimelineClip[]; subtitle: TimelineClip[] } {
  const shotTiming = new Map<number, { startSec: number; durationSec: number }>();

  for (const clip of videoClips) {
    const idx = clip.video?.shotIndex;
    if (idx !== undefined) {
      shotTiming.set(idx, { startSec: clip.startSec, durationSec: clip.durationSec });
    }
  }

  const narrationMap = buildShotNarrationMap(input);
  const shots: { shotIndex: number; text: string; startSec: number; durationSec: number }[] = [];
  for (const sb of input.storyboard) {
    const timing = shotTiming.get(sb.shotIndex);
    if (!timing) continue;
    // Phase 2B：无真实旁白的镜头不建 voice 轨（不用视觉描述冒充旁白）
    const text = narrationMap.get(sb.shotIndex) ?? "";
    if (!text.trim()) continue;
    shots.push({
      shotIndex: sb.shotIndex,
      text,
      startSec: timing.startSec,
      durationSec: timing.durationSec,
    });
  }

  return buildVoiceAndPhraseSubtitles(shots);
}

/** EditSequence → 多轨 EditTimeline */
export function sequenceToTimeline(
  sequence: EditSequence,
  input: BuildEditInput
): EditTimeline {
  const video: TimelineClip[] = [];
  let startSec = 0;

  for (const key of sequence.playOrder) {
    const clip = sequence.clips[key];
    if (!clip) continue;
    video.push({
      id: `vid-${key}`,
      track: "video",
      startSec,
      durationSec: clip.durationSec,
      sourceKey: key,
      label: clip.label,
      video: clip,
    });
    startSec += clip.durationSec;
  }

  const { voice, subtitle } = voiceAndSubtitleFromInput(input, video);

  return {
    fps: input.fps,
    aspectRatio: input.aspectRatio,
    durationSec: startSec,
    video,
    voice,
    music: [],
    subtitle,
    transitions: transitionsFromSequence(sequence, video),
  };
}

/** 多轨 video 轨 → EditSequence（供 Render Engine 兼容） */
export function timelineToSequence(timeline: EditTimeline): EditSequence {
  const playOrder: string[] = [];
  const clips: Record<string, import("../types").ClipSpec> = {};
  const transitions: EditTransition[] = [];

  const sorted = [...timeline.video].sort((a, b) => a.startSec - b.startSec);

  for (const clip of sorted) {
    const spec = clip.video;
    if (!spec) continue;
    playOrder.push(clip.sourceKey);
    clips[clip.sourceKey] = spec;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const fromKey = sorted[i].sourceKey;
    const toKey = sorted[i + 1].sourceKey;
    const tr = timeline.transitions.find((t) => t.afterClipId === sorted[i].id);
    transitions.push({
      fromKey,
      toKey,
      type: tr?.type ?? "cut",
      durationMs: tr?.durationMs ?? 0,
    });
  }

  const totalDurationSec = sorted.reduce((s, c) => s + c.durationSec, 0);

  return {
    playOrder,
    clips,
    transitions,
    pacingProfile: "documentary",
    totalDurationSec,
    updatedAt: new Date().toISOString(),
  };
}

/** 重建 voice/subtitle 轨并刷新 scriptMap 时间戳 */
export function rebuildDerivedTracks(
  timeline: EditTimeline,
  input: BuildEditInput
): { timeline: EditTimeline; scriptMap: ScriptSegment[] } {
  const { voice, subtitle } = voiceAndSubtitleFromInput(input, timeline.video);
  const next: EditTimeline = {
    ...timeline,
    voice,
    subtitle,
    durationSec: timeline.video.reduce((s, c) => s + c.durationSec, 0),
  };
  const scriptMap = attachTimelineToScriptMap(buildShotFirstScriptMap(input), next.video);
  return { timeline: next, scriptMap };
}

/** 从 video 轨 clip 顺序重建 startSec */
export function recalcVideoStarts(video: TimelineClip[]): TimelineClip[] {
  let startSec = 0;
  return video.map((clip) => {
    const next = { ...clip, startSec };
    startSec += clip.durationSec;
    return next;
  });
}

export function reorderTimelineVideo(
  timeline: EditTimeline,
  fromIndex: number,
  toIndex: number
): EditTimeline {
  const video = [...timeline.video];
  if (
    fromIndex < 0 ||
    fromIndex >= video.length ||
    toIndex < 0 ||
    toIndex >= video.length
  ) {
    return timeline;
  }
  const [item] = video.splice(fromIndex, 1);
  video.splice(toIndex, 0, item);
  const recalc = recalcVideoStarts(video);

  const playOrder = recalc.map((c) => c.sourceKey);
  const transitions: TimelineTransition[] = [];
  for (let i = 0; i < recalc.length - 1; i++) {
    const prev = timeline.transitions.find((t) => t.afterClipId === recalc[i].id);
    transitions.push(
      prev ?? {
        id: `tr-${recalc[i].sourceKey}-${recalc[i + 1].sourceKey}`,
        afterClipId: recalc[i].id,
        type: "cut",
        durationMs: 0,
      }
    );
  }

  return {
    ...timeline,
    video: recalc,
    transitions,
    durationSec: recalc.reduce((s, c) => s + c.durationSec, 0),
  };
}

export function updateTimelineClipDuration(
  timeline: EditTimeline,
  clipId: string,
  durationSec: number
): EditTimeline {
  const nextDur = Math.max(0.5, durationSec);
  const video = timeline.video.map((c) => {
    if (c.id !== clipId) return c;
    return {
      ...c,
      durationSec: nextDur,
      video: c.video ? { ...c.video, durationSec: nextDur } : c.video,
    };
  });
  const recalc = recalcVideoStarts(video);
  return {
    ...timeline,
    video: recalc,
    durationSec: recalc.reduce((s, c) => s + c.durationSec, 0),
  };
}

/** 同步 video clip 内嵌 ClipSpec 时长 */
export function syncClipSpecDurations(timeline: EditTimeline): EditTimeline {
  const video = timeline.video.map((c) => {
    if (!c.video) return c;
    return {
      ...c,
      video: { ...c.video, durationSec: c.durationSec },
    };
  });
  return { ...timeline, video };
}

export function graphToSequence(graph: import("./types").EditGraph): EditSequence {
  const seq = timelineToSequence(syncClipSpecDurations(graph.timeline));
  return { ...seq, pacingProfile: graph.pacingProfile };
}
