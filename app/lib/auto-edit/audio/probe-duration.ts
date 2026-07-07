import { spawnSync } from "child_process";
import "server-only";

let ffprobePath: string | undefined;

function getFfprobePath(): string {
  if (!ffprobePath) {
    // 动态 require，避免 Turbopack 解析平台二进制
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ffprobePath = (require("@ffprobe-installer/ffprobe") as { path: string }).path;
  }
  return ffprobePath;
}

/** 读取媒体文件时长（秒） */
export function probeMediaDurationSec(filepath: string): number {
  const r = spawnSync(
    getFfprobePath(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filepath,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`无法读取音频时长: ${filepath}`);
  }
  const sec = parseFloat(String(r.stdout).trim());
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error(`音频时长无效: ${filepath}`);
  }
  return sec;
}
