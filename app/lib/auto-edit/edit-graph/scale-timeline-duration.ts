import type { EditTimeline, MediaPoolItem, TimelineClip } from "./types";
import { recalcVideoStarts } from "./timeline-bridge";
import {
  realignVoiceClipsToVideo,
  rebuildSubtitleTrackFromVoice,
} from "../audio/align-voice-subtitle";

function scaleClipDuration(durationSec: number, scale: number, minSec: number): number {
  return Math.max(minSec, durationSec * scale);
}

/** 将时间线总时长按比例压缩到目标秒数（配音/画面同步缩放，避免 8min 目标 → 12min 成片） */
export function scaleTimelineToTargetDuration(
  timeline: EditTimeline,
  targetSec: number,
  mediaPool?: MediaPoolItem[]
): EditTimeline {
  const current = timeline.video.reduce((s, c) => s + c.durationSec, 0);
  if (current <= targetSec * 1.02 || targetSec <= 0) return timeline;

  const scale = targetSec / current;
  const video = recalcVideoStarts(
    timeline.video.map((c) => {
      const dur = scaleClipDuration(c.durationSec, scale, 0.4);
      return {
        ...c,
        durationSec: dur,
        video: c.video ? { ...c.video, durationSec: dur } : c.video,
      };
    })
  );

  const voice = realignVoiceClipsToVideo({ ...timeline, video }).map((v) => ({
    ...v,
    durationSec: scaleClipDuration(v.durationSec, scale, 0.3),
  }));

  const subtitle = mediaPool?.length
    ? rebuildSubtitleTrackFromVoice(voice, mediaPool)
    : timeline.subtitle.map((s) => ({
        ...s,
        startSec: s.startSec * scale,
        durationSec: scaleClipDuration(s.durationSec, scale, 0.2),
      }));

  const durationSec = video.reduce((sum, c) => sum + c.durationSec, 0);

  return {
    ...timeline,
    video,
    voice,
    subtitle,
    durationSec,
  };
}
