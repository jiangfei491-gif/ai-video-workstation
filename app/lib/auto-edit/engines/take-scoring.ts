import type { BatchShotState } from "@/app/lib/workbench-persist/types";

export type VideoProviderId = "veo" | "kling" | "runway" | "luma" | "pika" | "image";

export type TakeScores = {
  clarity: number;
  consistency: number;
  motion: number;
  continuity: number;
  total: number;
};

export type ShotTake = {
  id: string;
  provider: VideoProviderId;
  label: string;
  videoUrl: string | null;
  imageUrl?: string | null;
  scores: TakeScores;
  selected: boolean;
};

/** 启发式 Take 评分（Phase 2） */
export function scoreTake(
  shot: BatchShotState | undefined,
  frameUrl: string | undefined,
  provider: VideoProviderId = "veo"
): TakeScores {
  let clarity = 70;
  let consistency = 75;
  let motion = 72;
  let continuity = 74;

  if (shot?.status === "success" && shot.videoUrl) clarity += 12;
  if (frameUrl) consistency += 10;
  if (provider === "veo") motion += 8;
  if (shot?.error) {
    clarity -= 30;
    motion -= 20;
  }

  clarity = Math.min(99, Math.max(0, clarity));
  consistency = Math.min(99, Math.max(0, consistency));
  motion = Math.min(99, Math.max(0, motion));
  continuity = Math.min(99, Math.max(0, continuity));
  const total = Math.round((clarity + consistency + motion + continuity) / 4);

  return { clarity, consistency, motion, continuity, total };
}

export function pickBestTake(takes: ShotTake[]): ShotTake | null {
  if (!takes.length) return null;
  return [...takes].sort((a, b) => b.scores.total - a.scores.total)[0];
}

export function buildTakesForShot(
  shotIndex: number,
  batch: BatchShotState | undefined,
  frameUrl: string | undefined,
  extraTakes: ShotTake[] = []
): ShotTake[] {
  const takes: ShotTake[] = [...extraTakes];
  if (batch?.status === "success" && batch.videoUrl) {
    takes.push({
      id: `take-veo-${shotIndex}`,
      provider: "veo",
      label: "Take A · Veo",
      videoUrl: batch.videoUrl,
      imageUrl: batch.firstFrameUrl ?? frameUrl ?? null,
      scores: scoreTake(batch, frameUrl, "veo"),
      selected: false,
    });
  }
  if (frameUrl && !takes.some((t) => t.imageUrl === frameUrl)) {
    takes.push({
      id: `take-image-${shotIndex}`,
      provider: "image",
      label: "Take · 静帧",
      videoUrl: null,
      imageUrl: frameUrl,
      scores: scoreTake(undefined, frameUrl, "image"),
      selected: false,
    });
  }
  const best = pickBestTake(takes);
  if (best) best.selected = true;
  return takes;
}

/** 口播时长驱动 clip 时长（Phase 2 节奏优化） */
export function rhythmDurationFromVoice(
  voiceDurationSec: number,
  pacing: "documentary" | "viral" | "cinematic"
): number {
  const pad =
    pacing === "viral" ? 0.15 : pacing === "cinematic" ? 0.45 : 0.25;
  return Math.max(0.5, voiceDurationSec + pad);
}
