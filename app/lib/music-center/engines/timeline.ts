import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { MusicDirectorTask, MusicPlan } from "../types";

/** Rule Engine：将 Music Plan 转为 music 轨 TimelineClip */
export function buildMusicTimelineClips(
  task: MusicDirectorTask,
  plan: MusicPlan,
  mediaRefId = "bgm-main"
): TimelineClip[] {
  const vs = plan.volumeStrategy;
  const segments = vs.duckSegments?.length
    ? vs.duckSegments
    : [{ startSec: 0, endSec: task.durationSec, volume: vs.baseVolume }];

  return segments.map((seg, i) => {
    const durationSec = Math.max(0.1, seg.endSec - seg.startSec);
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    return {
      id: `bgm-${i}`,
      track: "music" as const,
      startSec: seg.startSec,
      durationSec,
      sourceKey: `bgm-${i}`,
      mediaRefId,
      label: i === 0 ? plan.bgmLabel : `${plan.bgmLabel} · Duck ${i + 1}`,
      audio: {
        volume: seg.volume,
        fadeInMs: isFirst ? Math.round(vs.fadeInSec * 1000) : undefined,
        fadeOutMs: isLast ? Math.round(vs.fadeOutSec * 1000) : undefined,
        duckUnderVoice: vs.duckUnderVoice,
      },
    };
  });
}

export function buildMediaPoolEntry(plan: MusicPlan, mediaRefId = "bgm-main") {
  return {
    id: mediaRefId,
    kind: "music" as const,
    label: plan.bgmLabel,
    url: plan.bgmUrl,
    origin: "library" as const,
    status: "ready" as const,
  };
}
