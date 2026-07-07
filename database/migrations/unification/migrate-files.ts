import fs from "node:fs";
import path from "node:path";

import { getWorkspaceManager } from "../../workspace";
import { legacyImportSourceRoot } from "./legacy-import-source";
import { DEFAULT_PROJECT_ID, LEGACY_MEDIA_MAP } from "./constants";
import type { FileMigrationStats } from "./types";

function copyFileSafe(src: string, dest: string, stats: FileMigrationStats, kind: keyof FileMigrationStats): boolean {
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) return false;
  fs.copyFileSync(src, dest);
  stats[kind] += 1;
  stats.copiedBytes += fs.statSync(dest).size;
  return true;
}

function copyDirFlat(
  srcDir: string,
  destDir: string,
  stats: FileMigrationStats,
  kind: keyof FileMigrationStats
): void {
  if (!fs.existsSync(srcDir)) return;
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    if (!fs.statSync(src).isFile()) continue;
    copyFileSafe(src, path.join(destDir, name), stats, kind);
  }
}

export function migrateLegacyFiles(projectId = DEFAULT_PROJECT_ID): FileMigrationStats {
  const ws = getWorkspaceManager();
  ws.ensureLayout({ includeProjectId: projectId });
  const pp = ws.getProjectPaths(projectId);
  const legacy = legacyImportSourceRoot();

  const stats: FileMigrationStats = {
    images: 0,
    videos: 0,
    audio: 0,
    subtitles: 0,
    exports: 0,
    opencut: 0,
    copiedBytes: 0,
  };

  copyDirFlat(path.join(legacy, "Images"), pp.images, stats, "images");
  copyDirFlat(path.join(legacy, "Videos"), pp.videos, stats, "videos");
  copyDirFlat(path.join(legacy, "Audio"), pp.audio, stats, "audio");
  copyDirFlat(path.join(legacy, "Projects"), pp.exports, stats, "exports");

  const subtitleSrc = path.join(legacy, "Projects");
  if (fs.existsSync(subtitleSrc)) {
    for (const name of fs.readdirSync(subtitleSrc)) {
      if (!/\.(srt|ass|vtt)$/i.test(name)) continue;
      copyFileSafe(path.join(subtitleSrc, name), path.join(pp.subtitle, name), stats, "subtitles");
    }
  }

  copyDirFlat(path.join(legacy, "BGM"), ws.getLibraryPaths().bgm, stats, "audio");

  const opencutLegacy = path.join(legacy, "Projects", "opencut");
  if (fs.existsSync(opencutLegacy)) {
    for (const name of fs.readdirSync(opencutLegacy)) {
      const src = path.join(opencutLegacy, name);
      const dest = path.join(pp.opencut, name);
      if (fs.statSync(src).isFile()) {
        copyFileSafe(src, dest, stats, "opencut");
      } else if (fs.statSync(src).isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        copyDirFlat(src, dest, stats, "opencut");
      }
    }
  }

  return stats;
}

export function legacyMediaAliases(): typeof LEGACY_MEDIA_MAP {
  return LEGACY_MEDIA_MAP;
}
