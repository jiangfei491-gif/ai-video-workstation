import path from "path";
import { resolveDesktopFile } from "@/app/lib/storage/desktop-veo";

/** 将 /api/files/Images/foo.png 或完整 URL 解析为本地绝对路径 */
export function resolveMediaFilePath(mediaUrl: string | undefined | null): string | null {
  if (!mediaUrl?.trim()) return null;
  const u = mediaUrl.trim();
  const marker = "/api/files/";
  const idx = u.indexOf(marker);
  if (idx >= 0) {
    const rel = u.slice(idx + marker.length).split("?")[0];
    return resolveDesktopFile(decodeURIComponent(rel));
  }
  if (u.startsWith("/api/files/")) {
    const rel = u.slice("/api/files/".length).split("?")[0];
    return resolveDesktopFile(decodeURIComponent(rel));
  }
  return null;
}

export function exportsVideoRelativePath(filename: string): string {
  return path.join("Videos", filename);
}

export { shotKey, parseShotIndex, clipLabel } from "./keys";
