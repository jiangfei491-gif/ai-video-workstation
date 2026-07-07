import type { EditTimeline, MediaPoolItem, TimelineClip } from "../edit-graph/types";
import type { BuildEditInput } from "../types";
import { rhythmDurationFromVoice } from "../engines/take-scoring";

function recalcVideoStarts(video: TimelineClip[]): TimelineClip[] {
  let startSec = 0;
  return video.map((clip) => {
    const next = { ...clip, startSec };
    startSec += clip.durationSec;
    return next;
  });
}

function syncClipSpecDurations(timeline: EditTimeline): EditTimeline {
  const video = timeline.video.map((c) => {
    if (!c.video) return c;
    return {
      ...c,
      video: { ...c.video, durationSec: c.durationSec },
    };
  });
  return { ...timeline, video };
}

/** 按句/短语切分口播（中英标点） */
export function splitNarrationPhrases(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/(?<=[。！？；.!?…])\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts;

  // 过长单句再按逗号切
  if (trimmed.length > 24) {
    return trimmed
      .split(/(?<=[，,、])\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

function phraseWeights(phrases: string[]): number[] {
  return phrases.map((p) => Math.max(1, p.replace(/\s/g, "").length));
}

function distributeDuration(
  totalSec: number,
  weights: number[],
  minPhraseSec = 0.45
): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  let durations = weights.map((w) => (totalSec * w) / sum);
  durations = durations.map((d) => Math.max(minPhraseSec, d));
  const scale = totalSec / durations.reduce((a, b) => a + b, 0);
  return durations.map((d) => d * scale);
}

export function parseShotIndexFromNarrKey(key: string): number | null {
  const m = /^narr-(\d+)$/.exec(key);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** 在一段时间窗内按句生成字幕轨 clip */
export function buildPhraseSubtitleClips(params: {
  shotIndex: number;
  text: string;
  startSec: number;
  durationSec: number;
}): TimelineClip[] {
  const phrases = splitNarrationPhrases(params.text);
  if (phrases.length === 0) return [];

  const weights = phraseWeights(phrases);
  const durations = distributeDuration(Math.max(0.5, params.durationSec), weights);
  let cursor = params.startSec;
  const clips: TimelineClip[] = [];

  phrases.forEach((phrase, i) => {
    const dur = durations[i] ?? 0.5;
    clips.push({
      id: `sub-${params.shotIndex}-${i}`,
      track: "subtitle",
      startSec: cursor,
      durationSec: dur,
      sourceKey: `narr-${params.shotIndex}`,
      mediaRefId: `sub-text-${params.shotIndex}-${i}`,
      label: `字幕 · 镜 ${params.shotIndex + 1}-${i + 1}`,
      subtitle: { text: phrase, style: "default" },
    });
    cursor += dur;
  });

  return clips;
}

export function resolveVoiceText(voiceClip: TimelineClip, mediaPool: MediaPoolItem[]): string {
  const item = mediaPool.find((p) => p.id === voiceClip.mediaRefId);
  return (item?.text ?? voiceClip.label).trim();
}

/** 根据配音轨重建字幕轨（按句 + 跟配音时长） */
export function rebuildSubtitleTrackFromVoice(
  voiceClips: TimelineClip[],
  mediaPool: MediaPoolItem[]
): TimelineClip[] {
  const sorted = [...voiceClips].sort((a, b) => a.startSec - b.startSec);
  const out: TimelineClip[] = [];

  for (const voice of sorted) {
    const shotIndex = parseShotIndexFromNarrKey(voice.sourceKey);
    if (shotIndex === null) continue;
    const text = resolveVoiceText(voice, mediaPool);
    if (!text) continue;
    out.push(
      ...buildPhraseSubtitleClips({
        shotIndex,
        text,
        startSec: voice.startSec,
        durationSec: voice.durationSec,
      })
    );
  }

  return out;
}

/** 镜长不短于配音实际时长，并重算 video 起点 */
export function extendVideoToVoiceDuration(
  timeline: EditTimeline,
  mediaPool: MediaPoolItem[]
): EditTimeline {
  const voiceByShot = new Map<number, TimelineClip>();
  for (const v of timeline.voice) {
    const idx = parseShotIndexFromNarrKey(v.sourceKey);
    if (idx !== null) voiceByShot.set(idx, v);
  }

  const video = timeline.video.map((clip) => {
    const idx = clip.video?.shotIndex;
    if (idx === undefined) return clip;
    const voice = voiceByShot.get(idx);
    if (!voice) return clip;

    const poolItem = mediaPool.find((p) => p.id === voice.mediaRefId);
    const voiceDur =
      poolItem?.status === "ready" && poolItem.url
        ? voice.durationSec
        : voice.durationSec;

    const nextDur = Math.max(
      clip.durationSec,
      rhythmDurationFromVoice(voiceDur, "documentary"),
      0.5
    );
    if (nextDur === clip.durationSec) return clip;
    return {
      ...clip,
      durationSec: nextDur,
      video: clip.video ? { ...clip.video, durationSec: nextDur } : clip.video,
    };
  });

  const recalc = recalcVideoStarts(video);
  return {
    ...timeline,
    video: recalc,
    durationSec: recalc.reduce((s, c) => s + c.durationSec, 0),
  };
}

/** 将配音 clip 贴回 video 镜起点，保留 TTS 真实时长 */
export function realignVoiceClipsToVideo(timeline: EditTimeline): TimelineClip[] {
  const videoByShot = new Map<number, TimelineClip>();
  for (const v of timeline.video) {
    const idx = v.video?.shotIndex;
    if (idx !== undefined) videoByShot.set(idx, v);
  }

  return timeline.voice.map((voice) => {
    const idx = parseShotIndexFromNarrKey(voice.sourceKey);
    if (idx === null) return voice;
    const video = videoByShot.get(idx);
    if (!video) return voice;
    return {
      ...voice,
      startSec: video.startSec,
      durationSec: Math.max(voice.durationSec, 0.5),
    };
  });
}

/** TTS 完成后：拉齐镜长、配音起点、按句字幕 */
export function alignTimelineAfterVoiceSynth(
  timeline: EditTimeline,
  mediaPool: MediaPoolItem[]
): EditTimeline {
  let next = extendVideoToVoiceDuration(timeline, mediaPool);
  const voice = realignVoiceClipsToVideo(next);
  const subtitle = rebuildSubtitleTrackFromVoice(voice, mediaPool);
  next = {
    ...next,
    voice,
    subtitle,
    durationSec: Math.max(
      next.video.reduce((s, c) => s + c.durationSec, 0),
      voice.reduce((s, c) => Math.max(s, c.startSec + c.durationSec), 0)
    ),
  };
  return syncClipSpecDurations(next);
}

/** 初次建轨：voice 一镜一条，subtitle 按句预估（镜长） */
export function buildVoiceAndPhraseSubtitles(
  shots: { shotIndex: number; text: string; startSec: number; durationSec: number }[]
): { voice: TimelineClip[]; subtitle: TimelineClip[] } {
  const voice: TimelineClip[] = [];
  const subtitle: TimelineClip[] = [];

  for (const sb of shots) {
    if (!sb.text.trim()) continue;
    voice.push({
      id: `voice-${sb.shotIndex}`,
      track: "voice",
      startSec: sb.startSec,
      durationSec: sb.durationSec,
      sourceKey: `narr-${sb.shotIndex}`,
      mediaRefId: `voice-script-${sb.shotIndex}`,
      label: `口播 · 镜 ${sb.shotIndex + 1}`,
      audio: { volume: 1, duckUnderVoice: false },
    });
    subtitle.push(
      ...buildPhraseSubtitleClips({
        shotIndex: sb.shotIndex,
        text: sb.text,
        startSec: sb.startSec,
        durationSec: sb.durationSec,
      })
    );
  }

  return { voice, subtitle };
}

/**
 * Shot 旁白 map（thin consumer）。
 * Closure：storyboard 若已带 per-shot 旁白（NarrationAssignment 写回，beat-aware），即为权威 assignment truth，
 *   直接消费——无旁白镜头保持空（禁止整脚本扁平分句跨 Beat 串位、禁止视觉描述冒充旁白）。
 * legacy：storyboard 无 per-shot 旁白时，才回退整脚本按句顺序分配（向后兼容旧数据）。
 */
export function buildShotNarrationMap(input: BuildEditInput): Map<number, string> {
  const map = new Map<number, string>();
  // 已带 per-shot 旁白（NarrationAssignment 写回）→ 权威 truth，逐字消费（与 assignment 同判据：非空即旁白）
  const preAssigned = input.storyboard.some((sb) => (sb.narration ?? "").trim().length > 0);
  if (preAssigned) {
    for (const sb of input.storyboard) map.set(sb.shotIndex, (sb.narration ?? "").trim());
    return map;
  }

  // legacy fallback：无 per-shot 旁白 → 整脚本按句顺序分配（用尽即空，不取视觉描述）
  for (const sb of input.storyboard) map.set(sb.shotIndex, "");
  const scriptPhrases = splitNarrationPhrases(input.script ?? "");
  if (scriptPhrases.length > 0) {
    const idxs = input.storyboard.map((sb) => sb.shotIndex);
    let phraseIdx = 0;
    for (const shotIdx of idxs) {
      const parts: string[] = [];
      const quota = Math.max(1, Math.ceil(scriptPhrases.length / idxs.length));
      for (let j = 0; j < quota && phraseIdx < scriptPhrases.length; j++) {
        parts.push(scriptPhrases[phraseIdx++]!);
      }
      map.set(shotIdx, parts.join(""));
    }
  }
  return map;
}
