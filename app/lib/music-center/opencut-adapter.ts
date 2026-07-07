import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { OpenCutCommand } from "@/app/lib/opencut/commands";
import type { MusicPlan, OpenCutMusicPayload } from "./types";

/** OpenCut Adapter — BGM 媒体 + 音频轨 + 音量命令 */
export function buildOpenCutMusicPayload(params: {
  clips: TimelineClip[];
  plan: MusicPlan;
  mediaRefId?: string;
}): OpenCutMusicPayload {
  const assetId = params.mediaRefId ?? "bgm-main";
  const commands: OpenCutCommand[] = [
    {
      action: "addMedia",
      assetId,
      url: params.plan.bgmUrl,
      kind: "audio",
    },
  ];

  const musicTracks = params.clips.map((c, trackIndex) => {
    commands.push({
      action: "insertClip",
      trackType: "audio",
      trackIndex: 1,
      clipId: c.id,
      assetId,
      start: c.startSec,
      duration: c.durationSec,
      label: c.label,
    });
    if (c.audio?.volume != null) {
      commands.push({
        action: "setVolume",
        trackType: "audio",
        trackIndex: 1,
        clipId: c.id,
        volume: c.audio.volume,
      });
    }
    return {
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
      assetId,
      label: c.label,
      volume: c.audio?.volume ?? params.plan.volumeStrategy.baseVolume,
    };
  });

  return { musicTracks, commands };
}
