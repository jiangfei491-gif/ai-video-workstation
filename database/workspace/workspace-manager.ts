import fs from "node:fs";
import path from "node:path";

import {
  createWorkspaceBackup,
  deleteWorkspaceBackup,
  listWorkspaceBackups,
  restoreWorkspaceBackup,
} from "./backup-manager";
import { bootstrapWorkspace } from "./bootstrap";
import {
  checkAndRepairDirs,
  removeDirectoryContents,
  runWorkspaceHealthCheck,
  scanDirectorySize,
} from "./health-check";
import {
  DATABASE_REL,
  PROJECT_REL_PATHS,
  STORAGE_REL,
  WORKSPACE_CONFIG_FILE,
  WORKSPACE_REL_PATHS,
  WORKSPACE_TOP_LEVEL,
  WORKSPACE_VERSION,
  libraryPath,
  modelPath,
} from "./paths";
import type {
  BackupRecord,
  BackupResult,
  DirCheckResult,
  IWorkspaceManager,
  LibraryPaths,
  ModelPaths,
  ProjectPathsV2,
  RestoreResult,
  SpaceStats,
  WorkspaceConfigFile,
  WorkspaceHealthReport,
  WorkspacePathsLegacy,
  WorkspacePathsV2,
  WorkspaceRelocateResult,
  WorkspaceSettingsData,
} from "./types";
import { relocateWorkspacePathOnly } from "./workspace-relocate";
import {
  readJsonFile,
  resolveAbsolute,
  resolveInitialWorkspaceRoot,
  resolveWorkspaceRootFromEnv,
  writeGlobalPointer,
} from "./workspace-core";
import { DEFAULT_PROJECT_ID } from "../migrations/unification/constants";

const DEFAULT_SETTINGS: WorkspaceSettingsData = {
  autoBackupEnabled: false,
  autoBackupIntervalHours: 24,
  autoInitOnStartup: true,
  autoRepairMissingDirs: true,
};

function buildWorkspacePaths(workspaceRoot: string): WorkspacePathsV2 & WorkspacePathsLegacy {
  const join = (...parts: string[]) => path.join(workspaceRoot, ...parts);
  const configRoot = join(WORKSPACE_TOP_LEVEL.config);
  const configFilePath = join(WORKSPACE_CONFIG_FILE);

  const base: WorkspacePathsV2 = {
    workspaceRoot,
    configFilePath,
    databaseRoot: join(WORKSPACE_TOP_LEVEL.database),
    storageRoot: join(WORKSPACE_TOP_LEVEL.storage),
    projectsRoot: join(STORAGE_REL.projects),
    libraryRoot: join(STORAGE_REL.library),
    modelRoot: join(WORKSPACE_TOP_LEVEL.models),
    logRoot: join(WORKSPACE_TOP_LEVEL.logs),
    backupRoot: join(WORKSPACE_TOP_LEVEL.backups),
    cacheRoot: join(STORAGE_REL.cache),
    tempRoot: join(STORAGE_REL.temp),
    exportRoot: join(STORAGE_REL.exports),
    pluginRoot: join(WORKSPACE_TOP_LEVEL.plugins),
    scriptRoot: join(WORKSPACE_TOP_LEVEL.scripts),
    templateRoot: join(WORKSPACE_TOP_LEVEL.templates),
  };

  return {
    ...base,
    databasePostgresRoot: join(WORKSPACE_REL_PATHS.databasePostgres),
    databaseMigrationsRoot: join(WORKSPACE_REL_PATHS.databaseMigrations),
    databaseBackupsRoot: join(WORKSPACE_REL_PATHS.databaseBackups),
    libraryMaterialsRoot: join(WORKSPACE_REL_PATHS.storageLibraryMaterials),
    libraryCharactersRoot: join(WORKSPACE_REL_PATHS.storageLibraryCharacters),
    libraryScenesRoot: join(WORKSPACE_REL_PATHS.storageLibraryScenes),
    libraryPropsRoot: join(WORKSPACE_REL_PATHS.storageLibraryProps),
    libraryBgmRoot: join(WORKSPACE_REL_PATHS.storageLibraryBgm),
    libraryVoicesRoot: join(WORKSPACE_REL_PATHS.storageLibraryVoices),
    libraryEffectsRoot: join(WORKSPACE_REL_PATHS.storageLibraryEffects),
    librarySubtitlesRoot: join(WORKSPACE_REL_PATHS.storageLibrarySubtitles),
    libraryTemplatesRoot: join(WORKSPACE_REL_PATHS.storageLibraryTemplates),
    configRoot,
  };
}

function buildLibraryPaths(workspaceRoot: string): LibraryPaths {
  const root = path.join(workspaceRoot, STORAGE_REL.library);
  return {
    root,
    materials: libraryPath(workspaceRoot, "materials"),
    characters: libraryPath(workspaceRoot, "characters"),
    scenes: libraryPath(workspaceRoot, "scenes"),
    props: libraryPath(workspaceRoot, "props"),
    bgm: libraryPath(workspaceRoot, "bgm"),
    sfx: libraryPath(workspaceRoot, "sfx"),
    voices: libraryPath(workspaceRoot, "voices"),
    subtitleStyles: libraryPath(workspaceRoot, "subtitleStyles"),
    effects: libraryPath(workspaceRoot, "effects"),
    transitions: libraryPath(workspaceRoot, "transitions"),
    templates: libraryPath(workspaceRoot, "templates"),
    prompts: libraryPath(workspaceRoot, "prompts"),
    lora: libraryPath(workspaceRoot, "lora"),
    fonts: libraryPath(workspaceRoot, "fonts"),
    stickers: libraryPath(workspaceRoot, "stickers"),
    overlays: libraryPath(workspaceRoot, "overlays"),
    logos: libraryPath(workspaceRoot, "logos"),
    watermarks: libraryPath(workspaceRoot, "watermarks"),
  };
}

function buildModelPaths(workspaceRoot: string): ModelPaths {
  const root = path.join(workspaceRoot, WORKSPACE_TOP_LEVEL.models);
  return {
    root,
    openai: modelPath(workspaceRoot, "openai"),
    claude: modelPath(workspaceRoot, "claude"),
    gemini: modelPath(workspaceRoot, "gemini"),
    deepseek: modelPath(workspaceRoot, "deepseek"),
    flux: modelPath(workspaceRoot, "flux"),
    comfyui: modelPath(workspaceRoot, "comfyui"),
    whisper: modelPath(workspaceRoot, "whisper"),
    fishspeech: modelPath(workspaceRoot, "fishspeech"),
    cosyvoice: modelPath(workspaceRoot, "cosyvoice"),
    f5tts: modelPath(workspaceRoot, "f5tts"),
    llama: modelPath(workspaceRoot, "llama"),
    qwen: modelPath(workspaceRoot, "qwen"),
    custom: modelPath(workspaceRoot, "custom"),
  };
}

function buildProjectPaths(projectsRoot: string, projectId: string): ProjectPathsV2 {
  const root = path.join(projectsRoot, projectId);
  const join = (rel: string) => path.join(root, rel);
  return {
    projectRoot: root,
    images: join(PROJECT_REL_PATHS.images),
    videos: join(PROJECT_REL_PATHS.videos),
    audio: join(PROJECT_REL_PATHS.audio),
    subtitle: join(PROJECT_REL_PATHS.subtitle),
    music: join(PROJECT_REL_PATHS.music),
    effects: join(PROJECT_REL_PATHS.effects),
    renders: join(PROJECT_REL_PATHS.renders),
    exports: join(PROJECT_REL_PATHS.exports),
    thumbnails: join(PROJECT_REL_PATHS.thumbnails),
    metadata: join(PROJECT_REL_PATHS.metadata),
    opencut: join(PROJECT_REL_PATHS.opencut),
    cache: join(PROJECT_REL_PATHS.cache),
    temp: join(PROJECT_REL_PATHS.temp),
    director: join(PROJECT_REL_PATHS.director),
    timeline: join(PROJECT_REL_PATHS.timeline),
    qa: join(PROJECT_REL_PATHS.qa),
    voice: join(PROJECT_REL_PATHS.voice),
    subtitleJson: join(PROJECT_REL_PATHS.subtitleJson),
  };
}

function resolveConfigFilePath(paths: WorkspacePathsV2): string {
  if (fs.existsSync(paths.configFilePath)) return paths.configFilePath;
  const v1 = path.join(paths.workspaceRoot, WORKSPACE_TOP_LEVEL.config, WORKSPACE_CONFIG_FILE);
  return fs.existsSync(v1) ? v1 : paths.configFilePath;
}

export class WorkspaceManager implements IWorkspaceManager {
  private _root: string;
  private _paths: WorkspacePathsV2 & WorkspacePathsLegacy;

  constructor(initialRoot?: string) {
    this._root = resolveAbsolute(initialRoot ?? resolveInitialWorkspaceRoot());
    this._paths = buildWorkspacePaths(this._root);
    this.applyConfigOverrides();
  }

  private applyConfigOverrides(): void {
    this._paths.configFilePath = resolveConfigFilePath(this._paths);
    const cfg = readJsonFile<WorkspaceConfigFile>(this._paths.configFilePath);
    if (cfg?.workspaceRoot && !resolveWorkspaceRootFromEnv()) {
      this._root = resolveAbsolute(cfg.workspaceRoot);
      this._paths = buildWorkspacePaths(this._root);
      this._paths.configFilePath = resolveConfigFilePath(this._paths);
    }
  }

  defaultProjectId(): string {
    const cfg = this.loadConfig();
    return cfg.defaultProjectId ?? DEFAULT_PROJECT_ID;
  }

  libraryJsonPath(filename: string): string {
    const lib = this.getLibraryPaths();
    const map: Record<string, string> = {
      "materials.json": path.join(lib.materials, "materials.json"),
      "characters.json": path.join(lib.characters, "characters.json"),
      "scenes.json": path.join(lib.scenes, "scenes.json"),
      "props.json": path.join(lib.props, "props.json"),
      "image-assets.json": path.join(lib.materials, "image-assets.json"),
      "material-schedules.json": path.join(lib.materials, "material-schedules.json"),
      "shot-locks.json": path.join(lib.materials, "shot-locks.json"),
      "auto-edit-jobs.json": path.join(lib.materials, "auto-edit-jobs.json"),
    };
    return map[filename] ?? path.join(lib.materials, filename);
  }

  get workspaceRoot(): string {
    return this._root;
  }

  get databaseRoot(): string {
    return this._paths.databaseRoot;
  }

  get storageRoot(): string {
    return this._paths.storageRoot;
  }

  get projectsRoot(): string {
    return this._paths.projectsRoot;
  }

  get libraryRoot(): string {
    return this._paths.libraryRoot;
  }

  get modelRoot(): string {
    return this._paths.modelRoot;
  }

  get logRoot(): string {
    return this._paths.logRoot;
  }

  get backupRoot(): string {
    return this._paths.backupRoot;
  }

  get cacheRoot(): string {
    return this._paths.cacheRoot;
  }

  get tempRoot(): string {
    return this._paths.tempRoot;
  }

  get exportRoot(): string {
    return this._paths.exportRoot;
  }

  get pluginRoot(): string {
    return this._paths.pluginRoot;
  }

  get scriptRoot(): string {
    return this._paths.scriptRoot;
  }

  get templateRoot(): string {
    return this._paths.templateRoot;
  }

  getPaths(): WorkspacePathsV2 & WorkspacePathsLegacy {
    return { ...this._paths, configFilePath: resolveConfigFilePath(this._paths) };
  }

  getLibraryPaths(): LibraryPaths {
    return buildLibraryPaths(this._root);
  }

  getModelPaths(): ModelPaths {
    return buildModelPaths(this._root);
  }

  getProjectPaths(projectId: string): ProjectPathsV2 {
    return buildProjectPaths(this._paths.projectsRoot, projectId);
  }

  loadConfig(): WorkspaceConfigFile {
    const cfgPath = resolveConfigFilePath(this._paths);
    const existing = readJsonFile<WorkspaceConfigFile>(cfgPath);
    if (existing) {
      return {
        ...existing,
        unified: true,
        settings: { ...DEFAULT_SETTINGS, ...existing.settings, unified: true },
      };
    }

    const now = new Date().toISOString();
    return {
      version: WORKSPACE_VERSION,
      workspaceRoot: this._root,
      unified: true,
      defaultProjectId: DEFAULT_PROJECT_ID,
      settings: { ...DEFAULT_SETTINGS, unified: true },
      createdAt: now,
      updatedAt: now,
    };
  }

  saveConfig(partial: Partial<WorkspaceConfigFile>): WorkspaceConfigFile {
    fs.mkdirSync(this._paths.configRoot, { recursive: true });
    fs.mkdirSync(this._root, { recursive: true });
    const current = this.loadConfig();
    const next: WorkspaceConfigFile = {
      ...current,
      ...partial,
      version: WORKSPACE_VERSION,
      settings: { ...DEFAULT_SETTINGS, ...current.settings, ...partial.settings },
      updatedAt: new Date().toISOString(),
    };
    const target = path.join(this._root, WORKSPACE_CONFIG_FILE);
    fs.writeFileSync(target, JSON.stringify(next, null, 2), "utf8");
    this._paths.configFilePath = target;
    return next;
  }

  getSettings(): WorkspaceSettingsData {
    return { ...DEFAULT_SETTINGS, ...this.loadConfig().settings };
  }

  updateSettings(partial: Partial<WorkspaceSettingsData>): WorkspaceSettingsData {
    const next = { ...this.getSettings(), ...partial };
    this.saveConfig({ settings: next });
    return next;
  }

  setWorkspaceRoot(newRoot: string): void {
    const abs = resolveAbsolute(newRoot);
    writeGlobalPointer(abs);
    this._root = abs;
    this._paths = buildWorkspacePaths(abs);
    this.saveConfig({ workspaceRoot: abs });
  }

  relocateWorkspacePath(newRoot: string): WorkspaceRelocateResult {
    return relocateWorkspacePathOnly(this._root, newRoot, (abs) => {
      writeGlobalPointer(abs);
      this._root = abs;
      this._paths = buildWorkspacePaths(abs);
      this.saveConfig({ workspaceRoot: abs });
    });
  }

  reload(): void {
    this._root = resolveInitialWorkspaceRoot();
    this._paths = buildWorkspacePaths(this._root);
    this.applyConfigOverrides();
  }

  ensureLayout(options?: { includeProjectId?: string }): void {
    checkAndRepairDirs(this._root, {
      includeProjectId: options?.includeProjectId ?? this.defaultProjectId(),
      repair: true,
    });
    fs.mkdirSync(path.join(this._paths.databaseRoot, DATABASE_REL.runtime), { recursive: true });
    fs.mkdirSync(this.getLibraryPaths().materials, { recursive: true });

    const cfgPath = path.join(this._root, WORKSPACE_CONFIG_FILE);
    if (!readJsonFile(cfgPath)) {
      this.saveConfig({});
      writeGlobalPointer(this._root);
    }
  }

  checkAndRepair(options?: { includeProjectId?: string }): DirCheckResult {
    return checkAndRepairDirs(this._root, {
      includeProjectId: options?.includeProjectId,
      repair: true,
    });
  }

  rescan(): DirCheckResult {
    return checkAndRepairDirs(this._root, { repair: false });
  }

  async runHealthCheck(): Promise<WorkspaceHealthReport> {
    const report = await runWorkspaceHealthCheck({
      workspaceRoot: this._root,
      configFilePath: resolveConfigFilePath(this._paths),
      databaseRoot: this.databaseRoot,
      storageRoot: this.storageRoot,
      libraryRoot: this.libraryRoot,
      modelRoot: this.modelRoot,
      logRoot: this.logRoot,
      backupRoot: this.backupRoot,
      cacheRoot: this.cacheRoot,
      exportRoot: this.exportRoot,
    });
    this.updateSettings({ lastHealthCheckAt: report.checkedAt });
    return report;
  }

  async scanSpaceUsage(maxDepth = 2): Promise<SpaceStats> {
    const byArea = scanDirectorySize(this._root, maxDepth);
    const totalBytes = Object.values(byArea).reduce((a, b) => a + b, 0);
    return {
      workspaceRoot: this._root,
      totalBytes,
      byArea,
      scannedAt: new Date().toISOString(),
    };
  }

  async cleanCache(options?: { includeTemp?: boolean; dryRun?: boolean }): Promise<{
    removed: string[];
    freedBytes: number;
  }> {
    const dryRun = options?.dryRun ?? false;
    const cache = removeDirectoryContents(this.cacheRoot, dryRun);
    if (options?.includeTemp) {
      const temp = removeDirectoryContents(this.tempRoot, dryRun);
      return {
        removed: [...cache.removed, ...temp.removed],
        freedBytes: cache.freedBytes + temp.freedBytes,
      };
    }
    return cache;
  }

  async createBackup(options?: {
    type?: BackupRecord["type"];
    incremental?: boolean;
  }): Promise<BackupResult> {
    return createWorkspaceBackup(this._root, resolveConfigFilePath(this._paths), options);
  }

  listBackups(): BackupRecord[] {
    return listWorkspaceBackups(this._root);
  }

  async restoreBackup(backupId: string, options?: { dryRun?: boolean }): Promise<RestoreResult> {
    return restoreWorkspaceBackup(
      this._root,
      resolveConfigFilePath(this._paths),
      backupId,
      options
    );
  }

  deleteBackup(backupId: string): { success: boolean; message: string } {
    return deleteWorkspaceBackup(this._root, backupId);
  }
}

let singleton: WorkspaceManager | null = null;
let bootstrapped = false;

export function getWorkspaceManager(): WorkspaceManager {
  if (!singleton) {
    singleton = new WorkspaceManager();
    if (!bootstrapped) {
      bootstrapped = true;
      bootstrapWorkspace(singleton);
    }
  }
  return singleton;
}

export function resetWorkspaceManager(): void {
  singleton = null;
  bootstrapped = false;
}

export function createWorkspaceManager(root?: string): WorkspaceManager {
  return new WorkspaceManager(root);
}

/** 便捷访问器 */
export const workspacePaths = {
  get workspaceRoot() {
    return getWorkspaceManager().workspaceRoot;
  },
  get projectRoot() {
    return getWorkspaceManager().projectsRoot;
  },
  get libraryRoot() {
    return getWorkspaceManager().libraryRoot;
  },
  get databaseRoot() {
    return getWorkspaceManager().databaseRoot;
  },
  get modelRoot() {
    return getWorkspaceManager().modelRoot;
  },
  get cacheRoot() {
    return getWorkspaceManager().cacheRoot;
  },
  get exportRoot() {
    return getWorkspaceManager().exportRoot;
  },
  get tempRoot() {
    return getWorkspaceManager().tempRoot;
  },
  get logRoot() {
    return getWorkspaceManager().logRoot;
  },
  get backupRoot() {
    return getWorkspaceManager().backupRoot;
  },
  get pluginRoot() {
    return getWorkspaceManager().pluginRoot;
  },
  get scriptRoot() {
    return getWorkspaceManager().scriptRoot;
  },
  get templateRoot() {
    return getWorkspaceManager().templateRoot;
  },
};
