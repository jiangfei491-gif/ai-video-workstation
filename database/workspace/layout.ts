import path from "node:path";

import {
  DATABASE_REL,
  LIBRARY_REL,
  MODEL_REL,
  PROJECT_REL,
  RESOURCE_CENTER_LIBRARY_REL,
  STORAGE_REL,
  WORKSPACE_TOP_LEVEL,
} from "./paths";

export function allTopLevelDirs(root: string): string[] {
  return [
    path.join(root, WORKSPACE_TOP_LEVEL.database),
    path.join(root, WORKSPACE_TOP_LEVEL.storage),
    path.join(root, WORKSPACE_TOP_LEVEL.models),
    path.join(root, WORKSPACE_TOP_LEVEL.logs),
    path.join(root, WORKSPACE_TOP_LEVEL.backups),
    path.join(root, WORKSPACE_TOP_LEVEL.config),
    path.join(root, WORKSPACE_TOP_LEVEL.plugins),
    path.join(root, WORKSPACE_TOP_LEVEL.scripts),
    path.join(root, WORKSPACE_TOP_LEVEL.templates),
  ];
}

export function allDatabaseDirs(root: string): string[] {
  const db = path.join(root, WORKSPACE_TOP_LEVEL.database);
  return [
    db,
    path.join(db, DATABASE_REL.postgres),
    path.join(db, DATABASE_REL.migrations),
    path.join(db, DATABASE_REL.backups),
    path.join(db, DATABASE_REL.runtime),
  ];
}

export function allStorageDirs(root: string): string[] {
  return [
    path.join(root, STORAGE_REL.projects),
    path.join(root, STORAGE_REL.library),
    path.join(root, STORAGE_REL.cache),
    path.join(root, STORAGE_REL.temp),
    path.join(root, STORAGE_REL.exports),
    path.join(root, STORAGE_REL.downloads),
  ];
}

export function allLibraryDirs(root: string): string[] {
  const lib = path.join(root, STORAGE_REL.library);
  return Object.values(LIBRARY_REL).map((rel) => path.join(lib, rel));
}

export function allResourceCenterLibraryDirs(root: string): string[] {
  const lib = path.join(root, STORAGE_REL.library);
  return Object.values(RESOURCE_CENTER_LIBRARY_REL).map((rel) => path.join(lib, rel));
}

export function allModelDirs(root: string): string[] {
  const models = path.join(root, WORKSPACE_TOP_LEVEL.models);
  return Object.values(MODEL_REL).map((rel) => path.join(models, rel));
}

export function allProjectDirs(projectsRoot: string, projectId: string): string[] {
  const root = path.join(projectsRoot, projectId);
  return Object.values(PROJECT_REL).map((rel) => path.join(root, rel));
}

/** V2 完整目录清单 */
export function allWorkspaceV2Dirs(root: string, projectId?: string): string[] {
  const dirs = [
    ...allTopLevelDirs(root),
    ...allDatabaseDirs(root),
    ...allStorageDirs(root),
    ...allLibraryDirs(root),
    ...allResourceCenterLibraryDirs(root),
    ...allModelDirs(root),
  ];
  if (projectId) {
    dirs.push(...allProjectDirs(path.join(root, STORAGE_REL.projects), projectId));
  }
  return [...new Set(dirs)];
}

export function listExpectedRelativePaths(): string[] {
  const fakeRoot = "/WORKSPACE";
  return allWorkspaceV2Dirs(fakeRoot).map((p) => p.replace(fakeRoot + path.sep, "").replace(fakeRoot, ""));
}
