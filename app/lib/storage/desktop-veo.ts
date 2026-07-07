import fs from "fs";
import path from "path";

import {
  defaultProjectId,
  libraryBgmDir,
  productionJsonFilePath,
  projectAudioDir,
  projectImagesDir,
  projectVideosDir,
  resolveWorkspaceRelativeFile,
  toWorkspaceFileUrl,
} from "./workspace-paths";
import { getWorkspaceManager } from "@/database/workspace";

/** @deprecated 使用 workspaceRoot */
export const DESKTOP_VEO_ROOT = () => getWorkspaceManager().workspaceRoot;

export const DESKTOP_VEO_DIRS = {
  get root() {
    return getWorkspaceManager().workspaceRoot;
  },
  get images() {
    return projectImagesDir();
  },
  get videos() {
    return projectVideosDir();
  },
  get audio() {
    return projectAudioDir();
  },
  get bgm() {
    return libraryBgmDir();
  },
  get projects() {
    return getWorkspaceManager().getLibraryPaths().materials;
  },
  get archive() {
    return getWorkspaceManager().backupRoot;
  },
} as const;

export function ensureDesktopVeoLayout(): void {
  getWorkspaceManager().ensureLayout({ includeProjectId: defaultProjectId() });
}

export function desktopImagePath(filename: string): string {
  ensureDesktopVeoLayout();
  return path.join(DESKTOP_VEO_DIRS.images, filename);
}

export function desktopVideoPath(filename: string): string {
  ensureDesktopVeoLayout();
  return path.join(DESKTOP_VEO_DIRS.videos, filename);
}

export function desktopAudioPath(filename: string): string {
  ensureDesktopVeoLayout();
  return path.join(DESKTOP_VEO_DIRS.audio, filename);
}

export function desktopBgmPath(filename: string): string {
  ensureDesktopVeoLayout();
  return path.join(DESKTOP_VEO_DIRS.bgm, filename);
}

export function desktopProjectPath(projectId: string, filename: string): string {
  ensureDesktopVeoLayout();
  const dir = getWorkspaceManager().getProjectPaths(projectId).metadata;
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

export function toDesktopFileUrl(relativePath: string): string {
  return toWorkspaceFileUrl(relativePath);
}

export function resolveDesktopFile(relativePath: string): string | null {
  return resolveWorkspaceRelativeFile(relativePath);
}
