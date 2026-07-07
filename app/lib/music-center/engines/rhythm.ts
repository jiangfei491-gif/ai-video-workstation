import { applyBeatSyncToTimeline } from "@/app/lib/auto-edit/engines/story-graph/beat-sync";
import type { EditTimeline } from "@/app/lib/auto-edit/edit-graph/types";
import type { BeatMarker, MusicPlan } from "../types";

/** 节奏分析：从 BPM 生成节拍网格 */
export function buildBeatGrid(durationSec: number, bpm: number): BeatMarker[] {
  if (bpm <= 0 || durationSec <= 0) return [];
  const interval = 60 / bpm;
  const markers: BeatMarker[] = [];
  for (let t = 0; t <= durationSec; t += interval) {
    markers.push({ sec: Math.round(t * 100) / 100, strength: 0.5 });
  }
  return markers;
}

/** 合并 DeepSeek 卡点与 BPM 网格 */
export function mergeBeatMarkers(plan: MusicPlan, durationSec: number): BeatMarker[] {
  const fromPlan = plan.beatMarkers ?? [];
  if (plan.bpm && plan.bpm > 0) {
    const grid = buildBeatGrid(durationSec, plan.bpm);
    const merged = [...fromPlan];
    for (const g of grid) {
      if (!merged.some((m) => Math.abs(m.sec - g.sec) < 0.05)) merged.push(g);
    }
    return merged.sort((a, b) => a.sec - b.sec);
  }
  return fromPlan;
}

/** 可选：对视频轨应用 BPM 卡点微调 */
export function applyBeatSyncIfEnabled(
  timeline: EditTimeline,
  bpm: number | undefined,
  enabled: boolean
): EditTimeline {
  if (!enabled || !bpm || bpm <= 0) return timeline;
  return applyBeatSyncToTimeline(timeline, bpm);
}
