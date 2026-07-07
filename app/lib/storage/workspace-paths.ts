/**
 * App 层路径 — 全部委托 WorkspaceManager，禁止 Legacy Desktop。
 */
import fs from "fs";
import path from "path";

import { DEFAULT_PROJECT_ID } from "@/database/migrations/unification/constants";
import { getWorkspaceManager } from "@/database/workspace";

function ws() {
  return getWorkspaceManager();
}

export function defaultProjectId(): string {
  const cfg = ws().loadConfig();
  return cfg.defaultProjectId ?? DEFAULT_PROJECT_ID;
}

export function projectImagesDir(projectId = defaultProjectId()): string {
  ws().ensureLayout({ includeProjectId: projectId });
  return ws().getProjectPaths(projectId).images;
}

export function projectVideosDir(projectId = defaultProjectId()): string {
  ws().ensureLayout({ includeProjectId: projectId });
  return ws().getProjectPaths(projectId).videos;
}

export function projectAudioDir(projectId = defaultProjectId()): string {
  ws().ensureLayout({ includeProjectId: projectId });
  return ws().getProjectPaths(projectId).audio;
}

export function libraryBgmDir(): string {
  ws().ensureLayout();
  return ws().getLibraryPaths().bgm;
}

export function librarySfxDir(): string {
  ws().ensureLayout();
  return ws().getLibraryPaths().sfx;
}

export function libraryJsonDir(): string {
  ws().ensureLayout();
  return ws().getLibraryPaths().materials;
}

export function productionJsonFilePath(name: string): string {
  ws().ensureLayout();
  const lib = ws().getLibraryPaths();
  const map: Record<string, string> = {
    "materials.json": path.join(lib.materials, "materials.json"),
    "characters.json": path.join(lib.characters, "characters.json"),
    "scenes.json": path.join(lib.scenes, "scenes.json"),
    "props.json": path.join(lib.props, "props.json"),
    "image-assets.json": path.join(lib.materials, "image-assets.json"),
    "material-schedules.json": path.join(lib.materials, "material-schedules.json"),
    "shot-locks.json": path.join(lib.materials, "shot-locks.json"),
    "auto-edit-jobs.json": path.join(lib.materials, "auto-edit-jobs.json"),
    "script-evolution-runs.json": path.join(lib.materials, "script-evolution-runs.json"),
    "script-evolution-script-records.json": path.join(lib.materials, "script-evolution-script-records.json"),
    "script-evolution-score-records.json": path.join(lib.materials, "script-evolution-score-records.json"),
  };
  return map[name] ?? path.join(lib.materials, name);
}

export function runtimeDataFilePath(name: string): string {
  ws().ensureLayout();
  return path.join(ws().databaseRoot, "runtime", name);
}

export function createTempDir(prefix: string): string {
  ws().ensureLayout();
  return fs.mkdtempSync(path.join(ws().tempRoot, prefix));
}

export function tempFilePath(filename: string): string {
  ws().ensureLayout();
  return path.join(ws().tempRoot, filename);
}

export function cacheDirFor(module: string): string {
  ws().ensureLayout();
  const dir = path.join(ws().cacheRoot, module);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function logDirFor(module: string): string {
  ws().ensureLayout();
  const dir = path.join(ws().logRoot, module);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function exportDirForProject(projectId: string): string {
  ws().ensureLayout({ includeProjectId: projectId });
  return ws().getProjectPaths(projectId).exports;
}

export function qaDirForProject(projectId: string): string {
  ws().ensureLayout({ includeProjectId: projectId });
  return ws().getProjectPaths(projectId).qa;
}

export function openCutProjectDir(projectId: string): string {
  ws().ensureLayout({ includeProjectId: projectId });
  return ws().getProjectPaths(projectId).opencut;
}

export function openCutVendorDir(): string {
  ws().ensureLayout();
  const inWorkspace = path.join(ws().pluginRoot, "opencut");
  if (fs.existsSync(inWorkspace)) return inWorkspace;
  return path.join(process.cwd(), "vendor", "opencut");
}

export function openCutSetupScriptPath(): string {
  ws().ensureLayout();
  const inWorkspace = path.join(ws().scriptRoot, "opencut-zh", "setup.sh");
  if (fs.existsSync(inWorkspace)) return inWorkspace;
  return path.join(process.cwd(), "scripts", "opencut-zh", "setup.sh");
}

export function bgmDirHint(): string {
  return libraryBgmDir();
}

/** URL 前缀兼容：Images/Videos/Audio/BGM → Workspace 实际路径 */
const URL_PREFIX_RESOLVER: Record<string, (pid: string) => string> = {
  Images: (pid) => ws().getProjectPaths(pid).images,
  Videos: (pid) => ws().getProjectPaths(pid).videos,
  Audio: (pid) => ws().getProjectPaths(pid).audio,
  BGM: () => ws().getLibraryPaths().bgm,
};

export function resolveWorkspaceRelativeFile(relativePath: string): string | null {
  const norm = relativePath.replace(/\\/g, "/");
  const pid = defaultProjectId();

  if (norm.startsWith("storage/")) {
    const fp = path.join(ws().workspaceRoot, norm);
    return fs.existsSync(fp) && fs.statSync(fp).isFile() ? fp : null;
  }

  const [prefix, ...rest] = norm.split("/");
  const resolver = prefix ? URL_PREFIX_RESOLVER[prefix] : undefined;
  if (resolver && rest.length) {
    const fp = path.join(resolver(pid), ...rest);
    return fs.existsSync(fp) && fs.statSync(fp).isFile() ? fp : null;
  }

  const abs = path.join(ws().storageRoot, norm);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  return null;
}

export function toWorkspaceFileUrl(relativePath: string): string {
  return `/api/files/${relativePath.split(path.sep).join("/")}`;
}

export { getWorkspaceManager };
