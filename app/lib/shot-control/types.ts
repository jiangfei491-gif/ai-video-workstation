export const SHOT_COUNT_OPTIONS = [3, 5, 8, 10] as const;
export type ShotCount = (typeof SHOT_COUNT_OPTIONS)[number];

export const SHOT_DURATION_OPTIONS = [3, 5, 8, 10] as const;
export type ShotDurationSec = (typeof SHOT_DURATION_OPTIONS)[number];

export function calcTotalDurationSec(
  shotCount: number,
  shotDurationSec: number
): number {
  return shotCount * shotDurationSec;
}

/** Veo API 仅支持 4 / 6 / 8 秒，将用户选项映射到最近可用值 */
export function normalizeVeoDurationSec(sec: number): 4 | 6 | 8 {
  if (sec <= 4) return 4;
  if (sec <= 6) return 6;
  return 8;
}
