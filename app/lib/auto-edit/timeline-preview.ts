import type { EditTimeline, MediaPoolItem, TimelineClip } from "./edit-graph/types";

export type VoicePreviewSource = {
  id: string;
  url: string;
  startSec: number;
  durationSec: number;
};

export function buildVoicePreviewSources(
  voiceClips: TimelineClip[],
  mediaPool: MediaPoolItem[]
): VoicePreviewSource[] {
  const out: VoicePreviewSource[] = [];
  for (const clip of voiceClips) {
    const item = mediaPool.find((p) => p.id === clip.mediaRefId);
    if (!item?.url) continue;
    out.push({
      id: clip.id,
      url: item.url,
      startSec: clip.startSec,
      durationSec: clip.durationSec,
    });
  }
  return out.sort((a, b) => a.startSec - b.startSec);
}

export function resolveSubtitleAtPlayhead(
  subtitleClips: TimelineClip[],
  playheadSec: number
): string | null {
  for (const clip of subtitleClips) {
    if (
      playheadSec >= clip.startSec &&
      playheadSec < clip.startSec + clip.durationSec
    ) {
      const text = clip.subtitle?.text?.trim();
      if (text) return text;
    }
  }
  return null;
}

export function resolveVoiceAtPlayhead(
  sources: VoicePreviewSource[],
  playheadSec: number
): (VoicePreviewSource & { offsetSec: number }) | null {
  for (const src of sources) {
    if (playheadSec >= src.startSec && playheadSec < src.startSec + src.durationSec) {
      return { ...src, offsetSec: playheadSec - src.startSec };
    }
  }
  return null;
}

export type ScrubVideoPreview = {
  videoUrl: string;
  clipOffsetSec: number;
};

/** 当前 playhead 所在镜头若有视频素材，用于 scrub 预览 */
export function resolveScrubVideoAtPlayhead(
  videoClips: EditTimeline["video"],
  batchResults: Record<
    number,
    { status: string; videoUrl: string | null; firstFrameUrl?: string | null }
  >,
  playheadSec: number
): ScrubVideoPreview | null {
  for (const clip of videoClips) {
    if (playheadSec < clip.startSec || playheadSec >= clip.startSec + clip.durationSec) {
      continue;
    }
    const idx = clip.video?.shotIndex;
    if (idx === undefined) continue;
    const batch = batchResults[idx];
    if (batch?.status === "success" && batch.videoUrl) {
      return {
        videoUrl: batch.videoUrl,
        clipOffsetSec: playheadSec - clip.startSec,
      };
    }
  }
  return null;
}
