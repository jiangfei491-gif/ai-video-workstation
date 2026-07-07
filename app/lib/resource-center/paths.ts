import path from "node:path";

import { RESOURCE_CENTER_LIBRARY_REL } from "@/database/workspace/paths";
import { getWorkspaceManager } from "@/database/workspace";

import type { LibraryId } from "./types";
import { LIBRARY_BY_ID } from "./libraries/definitions";

export function resolveLibraryStoragePath(libraryId: LibraryId): string {
  const rel = RESOURCE_CENTER_LIBRARY_REL[libraryId];
  if (!rel) {
    throw new Error(`未知内容库: ${libraryId}`);
  }
  return path.join(getWorkspaceManager().getLibraryPaths().root, rel);
}

export function resolveLibraryMetaPath(libraryId: LibraryId): string {
  return path.join(resolveLibraryStoragePath(libraryId), ".meta");
}

export function resolveResourceCenterManifestPath(): string {
  return path.join(getWorkspaceManager().getLibraryPaths().root, ".resource-center-manifest.json");
}

export function libraryIdFromStorageDir(dirName: string): LibraryId | null {
  const entry = Object.entries(RESOURCE_CENTER_LIBRARY_REL).find(([, rel]) => rel === dirName);
  return entry ? (entry[0] as LibraryId) : null;
}

export function assertLibraryStorageDir(libraryId: LibraryId): string {
  const def = LIBRARY_BY_ID[libraryId];
  const expected = RESOURCE_CENTER_LIBRARY_REL[libraryId];
  if (def.storageDir !== expected) {
    throw new Error(`内容库目录不一致: ${libraryId}`);
  }
  return expected;
}

export { RESOURCE_CENTER_LIBRARY_REL };
