import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { AiTimelineSpec, AiTimelineScene } from "./timeline-spec";
import { editGraphToOpenCutProject } from "./project-bridge";

function mediaUrl(graph: EditGraph, mediaRefId?: string): string | null {
  if (!mediaRefId) return null;
  return graph.mediaPool.find((p) => p.id === mediaRefId)?.url ?? null;
}

/** Edit Graph → AI Timeline Spec（Agent 标准输出） */
export function editGraphToTimelineSpec(
  graph: EditGraph,
  name: string,
  opts?: { bgmUrl?: string | null; bgmVolume?: number; duckUnderVoice?: boolean; coverImage?: string | null }
): AiTimelineSpec {
  const { timeline } = graph;
  const transitionByClip = new Map(timeline.transitions.map((t) => [t.afterClipId, t]));

  const scenes: AiTimelineScene[] = timeline.video.map((clip) => {
    const tr = transitionByClip.get(clip.id);
    const voiceClip = timeline.voice.find(
      (v) =>
        v.startSec <= clip.startSec + 0.05 &&
        v.startSec + v.durationSec >= clip.startSec + clip.durationSec - 0.05
    );
    const subClip = timeline.subtitle.find(
      (s) => s.startSec >= clip.startSec - 0.01 && s.startSec < clip.startSec + clip.durationSec
    );
    const kind = clip.video?.sourceKind === "video" ? "video" : clip.video?.sourceKind === "missing" ? "missing" : "image";

    return {
      id: clip.id,
      label: clip.label,
      media: mediaUrl(graph, clip.mediaRefId),
      mediaKind: kind,
      startSec: clip.startSec,
      endSec: clip.startSec + clip.durationSec,
      durationSec: clip.durationSec,
      subtitle: subClip?.subtitle?.text ?? null,
      voiceMedia: voiceClip ? mediaUrl(graph, voiceClip.mediaRefId) : null,
      cameraMotion: clip.video?.storyboardHint ?? null,
      shotIndex: clip.video?.shotIndex,
      transitionAfter: tr
        ? { afterSceneId: clip.id, type: tr.type, durationMs: tr.durationMs }
        : null,
    };
  });

  return {
    version: 1,
    name,
    fps: timeline.fps,
    aspectRatio: timeline.aspectRatio,
    durationSec: timeline.durationSec,
    scenes,
    voiceTrack: timeline.voice.map((c) => ({
      startSec: c.startSec,
      endSec: c.startSec + c.durationSec,
      media: mediaUrl(graph, c.mediaRefId),
      label: c.label,
    })),
    subtitleTrack: timeline.subtitle.map((c) => ({
      startSec: c.startSec,
      endSec: c.startSec + c.durationSec,
      text: c.subtitle?.text ?? c.label,
    })),
    bgm: opts?.bgmUrl
      ? {
          media: opts.bgmUrl,
          volume: opts.bgmVolume ?? 0.25,
          duckUnderVoice: opts.duckUnderVoice ?? true,
        }
      : null,
    coverImage: opts?.coverImage ?? null,
  };
}

/** Timeline Spec 摘要（调试 / API 响应） */
export function summarizeTimelineSpec(spec: AiTimelineSpec): string {
  return `${spec.scenes.length} 镜 · ${spec.durationSec.toFixed(1)}s · 配音 ${spec.voiceTrack.length} · 字幕 ${spec.subtitleTrack.length}`;
}

export { editGraphToOpenCutProject };
