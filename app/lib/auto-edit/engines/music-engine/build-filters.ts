import type { MusicEngineOptions } from "../types";

/** BGM FFmpeg 音频滤镜链：循环 / Fade In / Fade Out / 音量 */
export function buildBgmAudioFilter(
  inputRef: string,
  outputLabel: string,
  opts: MusicEngineOptions
): string {
  const parts: string[] = [];
  let cur = `[${inputRef}]`;

  if (opts.loop) {
    parts.push(`${cur}aloop=loop=-1:size=2e+09[bgmloop]`);
    cur = "[bgmloop]";
  }

  parts.push(
    `${cur}atrim=0:${opts.totalDurationSec.toFixed(2)},asetpts=PTS-STARTPTS[bgmtrim]`
  );
  cur = "[bgmtrim]";

  const fadeIn = opts.fadeInSec ?? 1.5;
  const fadeOut = opts.fadeOutSec ?? 2;
  const fadeOutStart = Math.max(0, opts.totalDurationSec - fadeOut);

  if (fadeIn > 0) {
    parts.push(`${cur}afade=t=in:st=0:d=${fadeIn.toFixed(2)}[bgmfi]`);
    cur = "[bgmfi]";
  }
  if (fadeOut > 0 && fadeOutStart > fadeIn) {
    parts.push(`${cur}afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeOut.toFixed(2)}[bgmfo]`);
    cur = "[bgmfo]";
  }

  const vol = opts.volume ?? 0.25;
  parts.push(`${cur}volume=${vol}[${outputLabel}]`);

  return parts.join(";");
}
