import path from "node:path";

import { STORAGE_REL } from "@/database/workspace/paths";
import { getWorkspaceManager } from "@/database/workspace";

export function resolveDownloadsRoot(): string {
  getWorkspaceManager().ensureLayout();
  return path.join(getWorkspaceManager().workspaceRoot, STORAGE_REL.downloads);
}

export function resolveDownloadDir(sourceId: string, taskId: string): string {
  return path.join(resolveDownloadsRoot(), sourceId, taskId);
}

export function resolveDownloadFilePath(
  sourceId: string,
  taskId: string,
  filename: string
): string {
  return path.join(resolveDownloadDir(sourceId, taskId), filename);
}

export function resolveDownloadPartPath(localPath: string): string {
  return `${localPath}.part`;
}
