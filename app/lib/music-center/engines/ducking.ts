import type { MusicDirectorTask, VolumeStrategy } from "../types";

const DEFAULT_BASE = 0.25;
const DEFAULT_DUCK = 0.12;
const DUCK_PAD_SEC = 0.15;

/** 根据配音片段生成 Ducking 音量曲线分段 */
export function buildDuckingSegments(
  task: MusicDirectorTask,
  strategy: Pick<VolumeStrategy, "baseVolume" | "duckUnderVoice" | "duckAmount">
): VolumeStrategy["duckSegments"] {
  const base = strategy.baseVolume ?? DEFAULT_BASE;
  if (!strategy.duckUnderVoice || !task.voiceClips?.length) {
    return [{ startSec: 0, endSec: task.durationSec, volume: base }];
  }

  const duckVol = Math.max(0.02, base - (strategy.duckAmount ?? DEFAULT_DUCK));
  const segments: VolumeStrategy["duckSegments"] = [];
  let cursor = 0;

  const sorted = [...task.voiceClips].sort((a, b) => a.startSec - b.startSec);

  for (const voice of sorted) {
    const duckStart = Math.max(0, voice.startSec - DUCK_PAD_SEC);
    const duckEnd = Math.min(task.durationSec, voice.startSec + voice.durationSec + DUCK_PAD_SEC);

    if (duckStart > cursor) {
      segments.push({ startSec: cursor, endSec: duckStart, volume: base });
    }
    if (duckEnd > duckStart) {
      segments.push({ startSec: duckStart, endSec: duckEnd, volume: duckVol });
    }
    cursor = Math.max(cursor, duckEnd);
  }

  if (cursor < task.durationSec) {
    segments.push({ startSec: cursor, endSec: task.durationSec, volume: base });
  }

  return segments.length > 0 ? segments : [{ startSec: 0, endSec: task.durationSec, volume: base }];
}

export function buildDefaultVolumeStrategy(task: MusicDirectorTask): VolumeStrategy {
  const base: VolumeStrategy = {
    baseVolume: task.baseVolume ?? DEFAULT_BASE,
    duckUnderVoice: task.duckUnderVoice !== false,
    duckAmount: task.duckAmount ?? DEFAULT_DUCK,
    fadeInSec: task.fadeInSec ?? 1.5,
    fadeOutSec: task.fadeOutSec ?? 2,
    duckSegments: [],
  };
  base.duckSegments = buildDuckingSegments(task, base);
  return base;
}
