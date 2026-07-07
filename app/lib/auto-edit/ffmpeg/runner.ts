import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { FfmpegCommand } from "../render-engine/types";

let resolved: string | null = null;

/**
 * 解析 ffmpeg 路径：优先用现代版（自带的 @ffmpeg-installer 是 2018 老版，
 * 缺 xfade 等 4.3+ 滤镜，转场渲染会失败）。
 * 顺序：FFMPEG_PATH 环境变量 → 常见系统安装位置 → 自带（兜底）。
 */
function ffmpegPath(): string {
  if (resolved) return resolved;
  const candidates = [
    process.env.FFMPEG_PATH?.trim(),
    path.join(process.cwd(), "vendor/ffmpeg/ffmpeg"), // 项目内置的现代版（含 xfade）
    "/opt/homebrew/bin/ffmpeg", // Apple Silicon brew
    "/usr/local/bin/ffmpeg", // Intel brew / 手动装
    "/usr/bin/ffmpeg",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (existsSync(c)) {
      resolved = c;
      return c;
    }
  }
  resolved = ffmpegInstaller.path; // 兜底：自带老版（可能不支持转场）
  return resolved;
}

/** 底层 FFmpeg 执行器 — 异步 spawn，避免阻塞 Node 事件循环（否则轮询/切页全挂） */
export function runFfmpegCommand(command: FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), command.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    const errStream = proc.stderr;
    if (!errStream) {
      reject(new Error(`${command.label} 失败: 无法读取 FFmpeg stderr`));
      return;
    }
    errStream.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command.label} 失败: ${stderr.slice(-500) || "FFmpeg 执行失败"}`
          )
        );
        return;
      }
      resolve();
    });
  });
}
