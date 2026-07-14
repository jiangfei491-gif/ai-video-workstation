/**
 * 音乐歌词模块 — 独立存储中心路径
 * storage/music/ 下分目录，与视频/项目存储完全隔离
 */
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceManager } from "@/database/workspace";
import type { StorageCategory } from "./types";

export function ensureMusicStorageLayout(): string {
  const ws = getWorkspaceManager();
  ws.ensureLayout();
  return path.join(ws.workspaceRoot, "storage", "music");
}

export function musicCategoryDir(category: StorageCategory): string {
  const root = ensureMusicStorageLayout();
  const dir = path.join(root, category);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function musicFileRelativePath(category: StorageCategory, filename: string): string {
  return path.posix.join("storage", "music", category, filename);
}
