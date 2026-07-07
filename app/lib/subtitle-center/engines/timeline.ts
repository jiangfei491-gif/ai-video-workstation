import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { SentenceTimestamp, SubtitlePlanClip, WordTimestamp } from "../types";

/** Rule Engine：从 Sentence / Word 时间戳构建字幕轨 */
export function buildClipsFromSentenceTimestamps(
  sentences: SentenceTimestamp[],
  prefix = "sub"
): SubtitlePlanClip[] {
  return sentences
    .filter((s) => s.text?.trim())
    .map((s, i) => ({
      id: `${prefix}-${i + 1}`,
      text: s.text.trim(),
      startSec: s.startSec,
      endSec: Math.max(s.endSec, s.startSec + 0.3),
    }));
}

export function buildClipsFromWordTimestamps(
  words: WordTimestamp[],
  prefix = "sub-w"
): SubtitlePlanClip[] {
  if (words.length === 0) return [];
  const clips: SubtitlePlanClip[] = [];
  let batch: WordTimestamp[] = [];
  const flush = () => {
    if (batch.length === 0) return;
    const text = batch.map((w) => w.word).join("");
    clips.push({
      id: `${prefix}-${clips.length + 1}`,
      text,
      startSec: batch[0]!.startSec,
      endSec: batch[batch.length - 1]!.endSec,
    });
    batch = [];
  };
  for (const w of words) {
    batch.push(w);
    if (batch.length >= 8 || /[。！？.!?]$/.test(w.word)) flush();
  }
  flush();
  return clips;
}

export function planClipsToTimelineClips(clips: SubtitlePlanClip[]): TimelineClip[] {
  return clips.map((c) => ({
    id: c.id,
    track: "subtitle" as const,
    sourceKey: c.id,
    mediaRefId: `sub-text-${c.id}`,
    label: c.text.slice(0, 24),
    startSec: c.startSec,
    durationSec: Math.max(0.2, c.endSec - c.startSec),
    subtitle: { text: c.text, style: "default" as const },
  }));
}
