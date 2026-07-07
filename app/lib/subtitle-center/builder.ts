import type { SubtitleDirectorTask, SubtitlePlanClip } from "./types";
import {
  buildClipsFromSentenceTimestamps,
  buildClipsFromWordTimestamps,
} from "./engines/timeline";

/**
 * Subtitle Builder — 不调用 AI。
 * 根据 Voice Center 返回的时间戳生成字幕片段。
 */
export function buildSubtitleClipsFromTask(task: SubtitleDirectorTask): SubtitlePlanClip[] {
  if (task.sentenceTimestamp?.length) {
    return buildClipsFromSentenceTimestamps(task.sentenceTimestamp, task.id);
  }
  if (task.wordTimestamp?.length) {
    return buildClipsFromWordTimestamps(task.wordTimestamp, task.id);
  }
  if (task.script?.trim()) {
    const lines = task.script
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let t = 0;
    return lines.map((text, i) => {
      const dur = Math.max(1.5, text.length * 0.12);
      const clip: SubtitlePlanClip = {
        id: `${task.id}-line-${i + 1}`,
        text,
        startSec: t,
        endSec: t + dur,
      };
      t += dur + 0.2;
      return clip;
    });
  }
  return [];
}
