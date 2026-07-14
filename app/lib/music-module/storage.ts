/**
 * 音乐存储中心 — 原始文件永不覆盖
 * 规范：所有抓取文件必须先入存储中心，解析后再写数据库
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceManager } from "@/database/workspace";
import { musicCategoryDir, musicFileRelativePath } from "./paths";
import type { StorageCategory } from "./types";

export function sha256Buffer(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function sha256Text(text: string): string {
  return sha256Buffer(Buffer.from(text, "utf8"));
}

/** 生成不可覆盖的唯一文件名：{timestamp}-{hash8}-{safeName} */
export function uniqueFilename(originalName: string, hash: string): string {
  const ts = Date.now();
  const hash8 = hash.slice(0, 8);
  const safe = originalName.replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]/g, "_").slice(0, 80);
  return `${ts}-${hash8}-${safe}`;
}

export type StoredFileResult = {
  absolutePath: string;
  relativePath: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  category: StorageCategory;
};

/**
 * 写入存储中心。若目标路径已存在则追加序号，绝不覆盖。
 */
export function writeImmutableFile(
  category: StorageCategory,
  originalName: string,
  content: Buffer | string,
  mimeType = "application/octet-stream"
): StoredFileResult {
  const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const hash = sha256Buffer(buf);
  const dir = musicCategoryDir(category);
  let filename = uniqueFilename(originalName, hash);
  let abs = path.join(dir, filename);
  let n = 1;
  while (fs.existsSync(abs)) {
    filename = uniqueFilename(`${n}-${originalName}`, hash);
    abs = path.join(dir, filename);
    n += 1;
  }
  fs.writeFileSync(abs, buf);
  return {
    absolutePath: abs,
    relativePath: musicFileRelativePath(category, filename),
    filename,
    sha256: hash,
    sizeBytes: buf.length,
    mimeType,
    category,
  };
}

export function readStoredFile(relativePath: string): Buffer | null {
  const ws = getWorkspaceManager();
  const abs = path.join(ws.workspaceRoot, relativePath.replace(/^storage[/\\]/, "storage/"));
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export function readStoredText(relativePath: string): string | null {
  const buf = readStoredFile(relativePath);
  return buf ? buf.toString("utf8") : null;
}
