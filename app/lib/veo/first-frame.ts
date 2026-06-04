import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

function getFfmpegPath(): string {
  return ffmpegInstaller.path;
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
