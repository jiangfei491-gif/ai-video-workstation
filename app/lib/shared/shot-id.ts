/** 稳定 Shot / ImageTask ID（client-safe，无 Node 依赖） */

export function shotIdFromIndex(index: number): string {
  return `SHOT_${String(index + 1).padStart(3, "0")}`;
}

export function imageTaskIdFromIndex(index: number): string {
  return `IMAGE_TASK_${String(index + 1).padStart(3, "0")}`;
}

export function shotIndexFromShotId(shotId: string): number | null {
  const m = /^SHOT_(\d+)$/.exec(shotId);
  if (!m) return null;
  return Math.max(0, parseInt(m[1], 10) - 1);
}

export function resolveShotIdForIndex(
  storyboard: { shotId?: string }[] | undefined,
  index: number
): string {
  return storyboard?.[index]?.shotId ?? shotIdFromIndex(index);
}
