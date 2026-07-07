import { detectMultiAction } from "./validate-multi-action";
import type { BeatSplitDiagnostics, NarrativeBeat, NarrativeShot } from "./types";

export function shotsForBeat(shots: NarrativeShot[], beatId: string): NarrativeShot[] {
  return shots.filter((s) => s.beatId === beatId);
}

/** Beat 含丰富过程但镜头过少 → UNDER_SPLIT */
export function isUnderSplitBeat(beat: NarrativeBeat, shots: NarrativeShot[]): boolean {
  const beatShots = shotsForBeat(shots, beat.beatId);
  const actionStages = beat.actionProcess?.filter(Boolean).length ?? 0;
  const reactionStages = beat.reactionProcess?.filter(Boolean).length ?? 0;
  const hasReveal = Boolean(beat.informationReveal?.trim());
  const richProcess = actionStages >= 2 && (reactionStages >= 1 || hasReveal);
  return richProcess && beatShots.length <= 2;
}

export function computeBeatSplitDiagnostics(
  beats: NarrativeBeat[],
  shots: NarrativeShot[]
): BeatSplitDiagnostics {
  const underSplitBeatIds: string[] = [];
  const singleShotBeatIds: string[] = [];

  for (const beat of beats) {
    const beatShots = shotsForBeat(shots, beat.beatId);
    if (beatShots.length <= 1) singleShotBeatIds.push(beat.beatId);
    if (isUnderSplitBeat(beat, shots)) underSplitBeatIds.push(beat.beatId);
  }

  let multiActionSingleShotCount = 0;
  for (const beat of beats) {
    const beatShots = shotsForBeat(shots, beat.beatId);
    if (beatShots.length === 1) {
      const actionStages = beat.actionProcess?.filter(Boolean).length ?? 0;
      if (actionStages >= 2 || detectMultiAction(beatShots[0]!.action).flagged) {
        multiActionSingleShotCount++;
      }
    }
  }

  return {
    underSplitBeatCount: underSplitBeatIds.length,
    singleShotBeatCount: singleShotBeatIds.length,
    multiActionSingleShotCount,
    underSplitBeatIds,
    singleShotBeatIds,
  };
}
