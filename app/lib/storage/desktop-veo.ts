import fs from "fs";
import os from "os";
import path from "path";

export const DESKTOP_VEO_ROOT = path.join(
  os.homedir(),
  "Desktop",
  "AI-Veo"
);

export const DESKTOP_VEO_DIRS = {
  root: DESKTOP_VEO_ROOT,
  images: path.join(DESKTOP_VEO_ROOT, "Images"),
  videos: path.join(DESKTOP_VEO_ROOT, "Videos"),
  projects: path.join(DESKTOP_VEO_ROOT, "Projects"),
  archive: path.join(DESKTOP_VEO_ROOT, "Archive"),
} as const;

export function ensureDesktopVeoLayout(): void {
  for (const dir of Object.values(DESKTOP_VEO_DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function desktopImagePath(filename: string): string {
  ensureDesktopVeoLayout();
  return path.join(DESKTOP_VEO_DIRS.images, filename);
}

export function desktopVideoPath(filename: string): string {
  ensureDesktopVeoLayout();
  return path.join(DESKTOP_VEO_DIRS.videos, filename);
}

export function desktopProjectPath(projectId: string, filename: string): string {
  ensureDesktopVeoLayout();
  const dir = path.join(DESKTOP_VEO_DIRS.projects, projectId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

/** 正式模式下对外可访问的本地文件路径（供 API 读取） */
export function toDesktopFileUrl(relativePath: string): string {
  return `/api/files/${relativePath.split(path.sep).join("/")}`;
}

export function resolveDesktopFile(relativePath: string): string | null {
  const root = path.resolve(DESKTOP_VEO_ROOT);
  const filepath = path.resolve(root, relativePath);
  if (!filepath.startsWith(`${root}${path.sep}`) && filepath !== root) {
    return null;
  }
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    return null;
  }
  return filepath;
}
