import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { MusicCenterExports, MusicPlan } from "../types";

export function buildMusicExports(params: {
  clips: TimelineClip[];
  plan: MusicPlan;
}): MusicCenterExports {
  const payload = {
    bgm: {
      filename: params.plan.bgmFilename,
      url: params.plan.bgmUrl,
      style: params.plan.style,
    },
    timeline: params.clips.map((c) => ({
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
      volume: c.audio?.volume,
      fadeInMs: c.audio?.fadeInMs,
      fadeOutMs: c.audio?.fadeOutMs,
    })),
    volumeStrategy: params.plan.volumeStrategy,
    climaxPoints: params.plan.climaxPoints,
    beatMarkers: params.plan.beatMarkers,
    sfxSuggestions: params.plan.sfxSuggestions,
    rationale: params.plan.rationale,
  };
  return { json: JSON.stringify(payload, null, 2) };
}
