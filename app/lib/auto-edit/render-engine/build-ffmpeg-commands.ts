import path from "path";
import { randomUUID } from "crypto";
import type { EditRenderMode, EditSequence } from "../types";
import {
  buildConcatCommand,
  buildImageSegmentCommand,
  buildVideoSegmentCommand,
} from "../ffmpeg/clip-commands";
import { desktopVideoPath } from "@/app/lib/storage/desktop-veo";
import { exportsVideoRelativePath } from "../resolve-media";
import type { AssetValidationResult, FfmpegCommand, RenderPlan, RenderTimeline } from "./types";

/** 将时间轴转为 FFmpeg 命令列表（不执行） */
export function buildFfmpegCommands(params: {
  sequence: EditSequence;
  mode: EditRenderMode;
  validation: AssetValidationResult;
  timeline: RenderTimeline;
  tmpDir: string;
}): Omit<RenderPlan, "sequence" | "mode"> & {
  outputFileName: string;
} {
  const { sequence, mode, validation, timeline, tmpDir } = params;
  const segmentCommands: FfmpegCommand[] = [];
  let segIdx = 0;

  for (const seg of timeline.segments) {
    if (seg.effectiveKind === "skip" || !seg.inputPath) continue;

    const outputPath = path.join(tmpDir, `seg-${String(segIdx).padStart(3, "0")}.mp4`);
    const label = `片段 ${segIdx + 1} · ${seg.label}`;

    if (seg.effectiveKind === "video") {
      segmentCommands.push(
        buildVideoSegmentCommand(
          `seg-${segIdx}`,
          seg.inputPath,
          outputPath,
          seg.durationSec,
          timeline.outputSize,
          timeline.fps,
          label
        )
      );
    } else {
      segmentCommands.push(
        buildImageSegmentCommand(
          `seg-${segIdx}`,
          seg.inputPath,
          outputPath,
          seg.durationSec,
          timeline.outputSize,
          timeline.fps,
          label,
          seg.motionSpec
        )
      );
    }
    segIdx++;
  }

  const outputFileName = `edit-${Date.now()}-${randomUUID().slice(0, 8)}.mp4`;
  const outputPath = desktopVideoPath(outputFileName);
  const concatListPath = path.join(tmpDir, "concat.txt");
  const concatCommand = buildConcatCommand(concatListPath, outputPath);

  return {
    validation,
    timeline,
    segmentCommands,
    concatListPath,
    concatCommand,
    outputPath,
    outputFileName,
    tmpDir,
  };
}

export function outputDesktopRelativePath(fileName: string): string {
  return exportsVideoRelativePath(fileName);
}
