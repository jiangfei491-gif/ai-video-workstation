/** Audio Engine：降噪 / 响度归一 / 压缩 */

export type AudioPostFilterOptions = {
  denoise?: boolean;
  loudnorm?: boolean;
  compress?: boolean;
};

export function buildVoicePostFilter(
  inputLabel: string,
  outputLabel: string,
  opts: AudioPostFilterOptions
): string | null {
  const parts: string[] = [];
  let cur = inputLabel;

  if (opts.denoise) {
    parts.push(`${cur}afftdn=nf=-25[vdn]`);
    cur = "[vdn]";
  }
  if (opts.compress) {
    parts.push(`${cur}acompressor=threshold=-18dB:ratio=3:attack=5:release=50[vcmp]`);
    cur = "[vcmp]";
  }
  if (opts.loudnorm) {
    parts.push(`${cur}loudnorm=I=-16:TP=-1.5:LRA=11[${outputLabel}]`);
  } else if (parts.length > 0) {
    parts.push(`${cur}anull[${outputLabel}]`);
  }

  return parts.length > 0 ? parts.join(";") : null;
}
