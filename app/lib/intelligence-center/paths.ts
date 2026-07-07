import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** 情报中心数据目录：与主工作台同一个家 ~/Desktop/AI-Veo/intelligence-center */
export function icDataDir(): string {
  const root =
    process.env.AI_VIDEO_OS_ROOT?.trim() ||
    process.env.WORKSPACE_ROOT?.trim() ||
    path.join(homedir(), "AI-Veo");
  return path.join(root, "intelligence-center");
}

/**
 * 原子写 JSON：先写临时文件再 rename（同盘 rename 原子），
 * 读者永远看到完整的旧文件或完整的新文件，不会读到写一半的半截内容。
 */
export function writeJsonAtomic(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, file);
}
