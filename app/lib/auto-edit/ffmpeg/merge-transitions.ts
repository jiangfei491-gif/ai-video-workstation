import fs from "fs";
import type { TransitionType } from "../types";
import type { FfmpegCommand } from "../render-engine/types";
import { toXfadeTransition } from "../engines/transition-engine";

/** 将分段 MP4 按转场链合并（Transition Engine → FFmpeg xfade / concat） */
export function buildTransitionMergeCommand(params: {
  segmentPaths: string[];
  segmentDurations: number[];
  transitions: { type: TransitionType; durationSec: number }[];
  outputPath: string;
}): FfmpegCommand {
  const { segmentPaths, segmentDurations, transitions, outputPath } = params;
  const n = segmentPaths.length;

  if (n === 0) {
    throw new Error("没有可合并的视频片段");
  }
  if (n === 1) {
    return {
      id: "merge-single",
      label: "合并成片",
      outputPath,
      args: ["-y", "-i", segmentPaths[0], "-c", "copy", outputPath],
    };
  }

  const allCut = transitions.every((t) => t.type === "cut" || t.durationSec <= 0);
  if (allCut) {
    const listPath = outputPath.replace(/\.mp4$/i, "-concat.txt");
    return {
      id: "merge-concat",
      label: "拼接成片",
      outputPath,
      args: [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        outputPath,
      ],
    };
  }

  const inputs: string[] = [];
  for (const p of segmentPaths) {
    inputs.push("-i", p);
  }

  const filters: string[] = [];
  for (let i = 0; i < n; i++) {
    filters.push(`[${i}:v]fps=24,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`);
  }

  let prev = "v0";
  let elapsed = segmentDurations[0];

  for (let i = 0; i < n - 1; i++) {
    const tr = transitions[i] ?? { type: "cut" as const, durationSec: 0 };
    const dur = tr.type === "cut" ? 0.001 : Math.max(0.05, tr.durationSec);
    const offset = Math.max(0, elapsed - dur);
    const out = i === n - 2 ? "vout" : `vx${i}`;
    filters.push(
      `[${prev}][v${i + 1}]xfade=transition=${toXfadeTransition(tr.type)}:duration=${dur.toFixed(3)}:offset=${offset.toFixed(3)}[${out}]`
    );
    prev = out;
    elapsed = elapsed + segmentDurations[i + 1] - dur;
  }

  return {
    id: "merge-xfade",
    label: "转场合并",
    outputPath,
    args: [
      "-y",
      ...inputs,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ],
  };
}

export function writeConcatListFile(listPath: string, segmentPaths: string[]): void {
  fs.writeFileSync(
    listPath,
    segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );
}
