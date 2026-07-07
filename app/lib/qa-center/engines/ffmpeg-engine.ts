import { spawnSync } from "child_process";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { QaIssue } from "../types";

export type FfmpegProbeResult = {
  width?: number;
  height?: number;
  durationSec?: number;
  hasAudio: boolean;
  hasVideo: boolean;
};

/** FFmpeg — 探测导出成片流信息 */
export function probeExportedVideo(filepath: string): FfmpegProbeResult {
  const r = spawnSync(
    ffprobeInstaller.path,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filepath,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`FFprobe 失败: ${filepath}`);
  }
  const data = JSON.parse(r.stdout || "{}") as {
    streams?: { width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const stream = data.streams?.[0];
  const audioCheck = spawnSync(
    ffprobeInstaller.path,
    ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", filepath],
    { encoding: "utf8" }
  );
  return {
    width: stream?.width,
    height: stream?.height,
    durationSec: data.format?.duration ? parseFloat(data.format.duration) : undefined,
    hasVideo: Boolean(stream?.width),
    hasAudio: Boolean(audioCheck.stdout?.trim()),
  };
}

/** FFmpeg blackdetect — 黑屏片段检测（OpenCV 等效探测） */
export function detectBlackSegments(filepath: string): QaIssue[] {
  const r = spawnSync(
    ffmpegInstaller.path,
    [
      "-i",
      filepath,
      "-vf",
      "blackdetect=d=0.5:pix_th=0.10",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" }
  );
  const stderr = r.stderr ?? "";
  const issues: QaIssue[] = [];
  const re = /black_start:([\d.]+)\s+black_end:([\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stderr)) !== null) {
    const start = parseFloat(match[1]!);
    const end = parseFloat(match[2]!);
    if (end - start >= 0.5) {
      issues.push({
        code: "black_frame",
        category: "opencv",
        message: `检测到黑屏 ${start.toFixed(1)}s–${end.toFixed(1)}s`,
        severity: "warning",
      });
    }
  }
  return issues;
}

export function runFfmpegQaChecks(filepath: string | null | undefined): QaIssue[] {
  if (!filepath) return [];
  const issues: QaIssue[] = [];
  try {
    const probe = probeExportedVideo(filepath);
    if (!probe.hasVideo) {
      issues.push({
        code: "no_video_stream",
        category: "ffmpeg",
        message: "导出文件无视频流",
        severity: "error",
      });
    }
    if (probe.width && probe.height) {
      const minDim = Math.min(probe.width, probe.height);
      if (minDim < 720) {
        issues.push({
          code: "low_resolution",
          category: "ffmpeg",
          message: `分辨率偏低 ${probe.width}×${probe.height}`,
          severity: "warning",
        });
      }
    }
    if (!probe.hasAudio) {
      issues.push({
        code: "no_audio_stream",
        category: "ffmpeg",
        message: "导出文件无音频轨",
        severity: "warning",
      });
    }
    issues.push(...detectBlackSegments(filepath));
  } catch (e) {
    issues.push({
      code: "ffmpeg_probe_failed",
      category: "ffmpeg",
      message: e instanceof Error ? e.message : "FFmpeg 探测失败",
      severity: "info",
    });
  }
  return issues;
}
