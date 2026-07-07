import type { EditEngineSettings } from "../edit-settings";

/** Effect Engine：片段级 FFmpeg 视频滤镜 */
export function buildEffectVideoFilter(
  inputLabel: string,
  outputLabel: string,
  effect: EditEngineSettings["effect"]
): string | null {
  if (!effect.enabled) return null;

  const filters: string[] = [];
  let cur = inputLabel;

  if (effect.sharpen) {
    filters.push(`${cur}unsharp=5:5:0.8:5:5:0.0[esh]`);
    cur = "[esh]";
  }
  if (effect.filmGrain) {
    filters.push(`${cur}noise=alls=8:allf=t+u[egr]`);
    cur = "[egr]";
  }
  if (effect.vignette) {
    filters.push(`${cur}vignette=angle=PI/4[evg]`);
    cur = "[evg]";
  }

  if (filters.length === 0) return null;
  filters.push(`${cur}format=yuv420p[${outputLabel}]`);
  return filters.join(";");
}
