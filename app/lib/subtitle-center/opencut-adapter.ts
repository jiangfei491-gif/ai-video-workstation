import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { OpenCutCommand } from "@/app/lib/opencut/commands";
import type { OpenCutSubtitlePayload, SubtitleAnimationId, SubtitleStyleTemplate } from "./types";

/** OpenCut Adapter — 生成字幕轨 + insertSubtitle 命令 */
export function buildOpenCutSubtitlePayload(params: {
  clips: TimelineClip[];
  style?: SubtitleStyleTemplate;
  animation?: SubtitleAnimationId;
}): OpenCutSubtitlePayload {
  const style = params.style ?? "default";
  const animation = params.animation ?? "fade";

  const subtitleTracks = params.clips
    .filter((c) => c.subtitle?.text?.trim())
    .map((c) => ({
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
      text: c.subtitle!.text.trim(),
      style,
      animation,
    }));

  const commands: OpenCutCommand[] = subtitleTracks.map((t) => ({
    action: "insertSubtitle" as const,
    clipId: t.id,
    text: t.text,
    start: t.startSec,
    duration: t.durationSec,
    style: "default" as const,
  }));

  return { subtitleTracks, commands };
}
