import fs from "fs";
import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import { resolveMediaFilePath } from "../resolve-media";
import type { EditTimeline, MediaPoolItem, TimelineClip } from "../edit-graph/types";
import {
  buildPhraseSubtitleClips,
  parseShotIndexFromNarrKey,
  resolveVoiceText,
} from "./align-voice-subtitle";

export type TranscriptSegment = {
  text: string;
  startSec: number;
  endSec: number;
};

type WhisperVerbose = {
  segments?: { start: number; end: number; text: string }[];
};

/** Whisper 转写单条配音，返回片段时间轴（相对音频 0 秒） */
export async function transcribeVoiceFile(filepath: string): Promise<TranscriptSegment[]> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return [];
  if (!fs.existsSync(filepath)) return [];

  const openai = new OpenAI({ apiKey });
  const file = fs.createReadStream(filepath);

  const result = (await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    language: "zh",
  })) as WhisperVerbose;

  const segments = result.segments ?? [];
  return segments
    .map((s) => ({
      text: s.text.trim(),
      startSec: s.start,
      endSec: Math.max(s.end, s.start + 0.2),
    }))
    .filter((s) => s.text.length > 0);
}

export function buildSubtitleClipsFromTranscript(params: {
  shotIndex: number;
  voiceStartSec: number;
  segments: TranscriptSegment[];
}): TimelineClip[] {
  const { shotIndex, voiceStartSec, segments } = params;
  if (segments.length === 0) return [];

  return segments.map((seg, i) => ({
    id: `sub-${shotIndex}-w${i}`,
    track: "subtitle" as const,
    startSec: voiceStartSec + seg.startSec,
    durationSec: Math.max(0.25, seg.endSec - seg.startSec),
    sourceKey: `narr-${shotIndex}`,
    mediaRefId: `sub-text-${shotIndex}-w${i}`,
    label: `字幕 · 镜 ${shotIndex + 1}-${i + 1}`,
    subtitle: { text: seg.text, style: "default" as const },
  }));
}

/**
 * 用 Whisper 片段时间轴重建字幕轨（配音已对齐后调用）。
 * 无 API Key 或转写失败时回退到按句比例分配。
 */
export async function alignSubtitlesWithWhisper(
  timeline: EditTimeline,
  mediaPool: MediaPoolItem[],
  onProgress?: (message: string) => void
): Promise<EditTimeline> {
  if (!getOpenAIApiKey()) return timeline;

  const subtitle: TimelineClip[] = [];
  const voiceSorted = [...timeline.voice].sort((a, b) => a.startSec - b.startSec);

  for (const voice of voiceSorted) {
    const shotIndex = parseShotIndexFromNarrKey(voice.sourceKey);
    if (shotIndex === null) continue;

    const item = mediaPool.find((p) => p.id === voice.mediaRefId);
    const filepath = resolveMediaFilePath(item?.url);
    const fallbackText = resolveVoiceText(voice, mediaPool);

    if (!filepath) {
      if (fallbackText) {
        subtitle.push(
          ...buildPhraseSubtitleClips({
            shotIndex,
            text: fallbackText,
            startSec: voice.startSec,
            durationSec: voice.durationSec,
          })
        );
      }
      continue;
    }

    onProgress?.(`Whisper 对齐 · 镜 ${shotIndex + 1}`);

    try {
      const segments = await transcribeVoiceFile(filepath);
      const clips = buildSubtitleClipsFromTranscript({
        shotIndex,
        voiceStartSec: voice.startSec,
        segments,
      });

      if (clips.length > 0) {
        subtitle.push(...clips);
        continue;
      }
    } catch {
      /* fallback below */
    }

    if (fallbackText) {
      subtitle.push(
        ...buildPhraseSubtitleClips({
          shotIndex,
          text: fallbackText,
          startSec: voice.startSec,
          durationSec: voice.durationSec,
        })
      );
    }
  }

  if (subtitle.length === 0) return timeline;

  return {
    ...timeline,
    subtitle,
  };
}
