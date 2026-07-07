import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { tempFilePath } from "@/app/lib/storage/workspace-paths";

function getFfmpegPath(): string {
  return ffmpegInstaller.path;
}

export function getVideoDurationSec(videoPath: string): number {
  const result = spawnSync(
    ffprobeInstaller.path,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ],
    { encoding: "utf8" }
  );
  const d = parseFloat((result.stdout ?? "").trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * 沿时间轴均匀抽取 N 帧（缩到最长边 768，控制视觉请求体积）。
 * 用于"视频反推提示词"：综合多帧理解动作时序与镜头运动。
 */
export function extractFramesFromVideo(
  videoPath: string,
  count = 5
): Buffer[] {
  const ffmpeg = getFfmpegPath();
  const duration = getVideoDurationSec(videoPath);
  const n = duration > 0 ? Math.max(1, count) : 1;
  const frames: Buffer[] = [];

  for (let i = 0; i < n; i++) {
    const t = duration > 0 ? duration * ((i + 0.5) / n) : 0;
    const out = tempFilePath(`vframe-${randomUUID()}.png`);
    const result = spawnSync(
      ffmpeg,
      [
        "-y",
        "-ss",
        t.toFixed(2),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(768,iw)':-2",
        "-q:v",
        "3",
        out,
      ],
      { encoding: "utf8" }
    );
    if (result.status === 0 && fs.existsSync(out)) {
      try {
        frames.push(fs.readFileSync(out));
      } finally {
        try {
          fs.unlinkSync(out);
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (frames.length === 0) {
    throw new Error("视频抽帧失败：未能提取任何帧");
  }
  return frames;
}

export function extractFirstFrameFromVideo(
  videoPath: string,
  outputPath: string
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const ffmpeg = getFfmpegPath();
  const result = spawnSync(
    ffmpeg,
    ["-y", "-i", videoPath, "-vframes", "1", "-q:v", "2", outputPath],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(
      `首帧提取失败: ${result.stderr?.slice(-500) ?? "unknown error"}`
    );
  }
  if (!fs.existsSync(outputPath)) {
    throw new Error("首帧提取失败：输出文件不存在");
  }
}
