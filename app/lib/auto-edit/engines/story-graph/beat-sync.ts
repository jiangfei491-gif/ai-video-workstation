import type { EditTimeline, TimelineClip } from "../../edit-graph/types";

/** 将各镜结束点对齐到 BPM 网格（微调镜长，保持顺序） */
export function applyBeatSyncToTimeline(timeline: EditTimeline, bpm: number): EditTimeline {
  if (bpm <= 0 || timeline.video.length === 0) return timeline;

  const beatInterval = 60 / bpm;
  const sorted = [...timeline.video].sort((a, b) => a.startSec - b.startSec);
  let cursor = 0;

  const video: TimelineClip[] = sorted.map((clip) => {
    let dur = Math.max(0.5, clip.durationSec);
    const endAt = cursor + dur;
    const snappedEnd = Math.round(endAt / beatInterval) * beatInterval;
    if (snappedEnd > cursor + 0.45) {
      dur = snappedEnd - cursor;
    }
    const startSec = cursor;
    cursor += dur;
    return {
      ...clip,
      startSec,
      durationSec: dur,
      video: clip.video ? { ...clip.video, durationSec: dur } : clip.video,
    };
  });

  return {
    ...timeline,
    video,
    durationSec: cursor,
  };
}
