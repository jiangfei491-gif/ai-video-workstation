import type { FfmpegCommand } from "../render-engine/types";
import type { ShotMotionSpec } from "../render-engine/shot-motion-resolver";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const f4 = (v: number): string => v.toFixed(4);

/**
 * 把结构化 motionSpec 翻译为 FFmpeg zoompan 表达式（纯翻译，无业务规则）。
 * 用 on/帧数 做线性插值：z 从 zoomStart→zoomEnd；x/y 窗口从焦点起点漂移到终点。
 * 表达式内不含逗号 / min / max，避免 filtergraph 转义问题（比例已在 JS 侧夹紧）。
 */
function motionZoompan(
  spec: ShotMotionSpec,
  frames: number,
  size: { w: number; h: number },
  fps: number
): string {
  const F = Math.max(1, frames - 1);
  const zs = Math.max(1, spec.zoomStart);
  const ze = Math.max(1, spec.zoomEnd);
  // x/y 归一化窗口位置（0..1），起点/终点由焦点 ± 位移量决定，JS 侧夹紧到 [0,1]
  const rxs = clamp01(spec.focusX - spec.panX / 2);
  const rxe = clamp01(spec.focusX + spec.panX / 2);
  const rys = clamp01(spec.focusY - spec.panY / 2);
  const rye = clamp01(spec.focusY + spec.panY / 2);
  const z = `${f4(zs)}+(${f4(ze)}-${f4(zs)})*on/${F}`;
  const x = `(iw-iw/zoom)*(${f4(rxs)}+(${f4(rxe)}-${f4(rxs)})*on/${F})`;
  const y = `(ih-ih/zoom)*(${f4(rys)}+(${f4(rye)}-${f4(rys)})*on/${F})`;
  return `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${size.w}x${size.h}:fps=${fps}`;
}

export function buildImageSegmentCommand(
  id: string,
  inputPath: string,
  outputPath: string,
  durationSec: number,
  size: { w: number; h: number },
  fps: number,
  label: string,
  motionSpec?: ShotMotionSpec | null
): FfmpegCommand {
  const frames = Math.max(1, Math.round(durationSec * fps));
  // 有镜头语言 → per-clip 运动；否则回退旧固定 Ken Burns（向后兼容）
  const zoompan = motionSpec
    ? motionZoompan(motionSpec, frames, size, fps)
    : `zoompan=z='min(zoom+0.0008,1.08)':d=${frames}:s=${size.w}x${size.h}:fps=${fps}`;
  const vf = [
    `scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease`,
    `pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2:black`,
    zoompan,
  ].join(",");
  return {
    id,
    label,
    outputPath,
    args: [
      "-y",
      "-loop",
      "1",
      "-i",
      inputPath,
      "-t",
      String(durationSec),
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
      outputPath,
    ],
  };
}

export function buildVideoSegmentCommand(
  id: string,
  inputPath: string,
  outputPath: string,
  durationSec: number,
  size: { w: number; h: number },
  fps: number,
  label: string
): FfmpegCommand {
  const vf = [
    `scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease`,
    `pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2:black`,
  ].join(",");
  return {
    id,
    label,
    outputPath,
    args: [
      "-y",
      "-i",
      inputPath,
      "-t",
      String(durationSec),
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
      "-an",
      outputPath,
    ],
  };
}

export function buildConcatCommand(
  concatListPath: string,
  outputPath: string
): FfmpegCommand {
  return {
    id: "concat-final",
    label: "拼接成片",
    outputPath,
    args: ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", outputPath],
  };
}
