/**
 * Workspace V2 — 类型定义
 */

export interface WorkspaceSettingsData {
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoInitOnStartup: boolean;
  autoRepairMissingDirs: boolean;
  lastHealthCheckAt?: string;
  lastBackupAt?: string;
}

export interface WorkspaceConfigFile {
  version: number;
  workspaceRoot: string;
  unified?: boolean;
  defaultWorkspaceId?: string;
  defaultProjectId?: string;
  settings?: WorkspaceSettingsData & {
    unified?: boolean;
    unifiedAt?: string;
    migrationReportPath?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspacePathsV2 {
  workspaceRoot: string;
  configFilePath: string;
  databaseRoot: string;
  storageRoot: string;
  projectsRoot: string;
  libraryRoot: string;
  modelRoot: string;
  logRoot: string;
  backupRoot: string;
  cacheRoot: string;
  tempRoot: string;
  exportRoot: string;
  pluginRoot: string;
  scriptRoot: string;
  templateRoot: string;
}

export interface LibraryPaths {
  root: string;
  materials: string;
  characters: string;
  scenes: string;
  props: string;
  bgm: string;
  sfx: string;
  voices: string;
  subtitleStyles: string;
  effects: string;
  transitions: string;
  templates: string;
  prompts: string;
  lora: string;
  fonts: string;
  stickers: string;
  overlays: string;
  logos: string;
  watermarks: string;
}

export interface ModelPaths {
  root: string;
  openai: string;
  claude: string;
  gemini: string;
  deepseek: string;
  flux: string;
  comfyui: string;
  whisper: string;
  fishspeech: string;
  cosyvoice: string;
  f5tts: string;
  llama: string;
  qwen: string;
  custom: string;
}

export interface ProjectPathsV2 {
  projectRoot: string;
  images: string;
  videos: string;
  audio: string;
  subtitle: string;
  music: string;
  effects: string;
  renders: string;
  exports: string;
  thumbnails: string;
  metadata: string;
  opencut: string;
  cache: string;
  temp: string;
  director: string;
  timeline: string;
  qa: string;
  voice: string;
  subtitleJson: string;
}

/** @deprecated V1 兼容 */
export type WorkspacePaths = WorkspacePathsV2 & Record<string, string>;
export type ProjectPaths = ProjectPathsV2;

export type HealthStatus = "ok" | "warning" | "error";

export interface HealthCheckItem {
  area: string;
  status: HealthStatus;
  message: string;
  path?: string;
}

export interface WorkspaceHealthReport {
  ok: boolean;
  checkedAt: string;
  workspaceRoot: string;
  diskFreeBytes?: number;
  diskTotalBytes?: number;
  items: HealthCheckItem[];
}

export interface DirCheckResult {
  missing: string[];
  created: string[];
  ok: boolean;
}

export interface SpaceStats {
  workspaceRoot: string;
  totalBytes: number;
  byArea: Record<string, number>;
  scannedAt: string;
}

export interface BackupRecord {
  id: string;
  type: "full" | "incremental" | "manual";
  createdAt: string;
  path: string;
  sizeBytes: number;
  manifestPath: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupRecord;
  message: string;
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  message: string;
}

export interface WorkspaceRelocateResult {
  success: boolean;
  oldRoot: string;
  newRoot: string;
  message: string;
  /** 仅改路径，不复制数据 */
  dataCopied: false;
}

export interface IWorkspaceManager {
  readonly workspaceRoot: string;

  /** V2 根路径访问器 */
  databaseRoot: string;
  storageRoot: string;
  projectsRoot: string;
  libraryRoot: string;
  modelRoot: string;
  logRoot: string;
  backupRoot: string;
  cacheRoot: string;
  tempRoot: string;
  exportRoot: string;
  pluginRoot: string;
  scriptRoot: string;
  templateRoot: string;

  getPaths(): WorkspacePathsV2;
  getLibraryPaths(): LibraryPaths;
  getModelPaths(): ModelPaths;
  getProjectPaths(projectId: string): ProjectPathsV2;

  defaultProjectId(): string;
  libraryJsonPath(filename: string): string;

  /** 首次启动 / 手动：初始化完整 V2 目录 */
  ensureLayout(options?: { includeProjectId?: string }): void;

  /** 启动检查 + 自动修复缺失目录 */
  checkAndRepair(options?: { includeProjectId?: string }): DirCheckResult;

  runHealthCheck(): Promise<WorkspaceHealthReport>;

  loadConfig(): WorkspaceConfigFile;
  saveConfig(partial: Partial<WorkspaceConfigFile>): WorkspaceConfigFile;
  getSettings(): WorkspaceSettingsData;
  updateSettings(partial: Partial<WorkspaceSettingsData>): WorkspaceSettingsData;

  setWorkspaceRoot(newRoot: string): void;
  relocateWorkspacePath(newRoot: string): WorkspaceRelocateResult;

  scanSpaceUsage(maxDepth?: number): Promise<SpaceStats>;
  cleanCache(options?: { includeTemp?: boolean; dryRun?: boolean }): Promise<{ removed: string[]; freedBytes: number }>;
  rescan(): DirCheckResult;

  createBackup(options?: { type?: BackupRecord["type"]; incremental?: boolean }): Promise<BackupResult>;
  listBackups(): BackupRecord[];
  restoreBackup(backupId: string, options?: { dryRun?: boolean }): Promise<RestoreResult>;
  deleteBackup(backupId: string): { success: boolean; message: string };

  reload(): void;
}

/** @deprecated 使用 WorkspacePathsV2 */
export interface WorkspacePathsLegacy extends WorkspacePathsV2 {
  databasePostgresRoot: string;
  databaseMigrationsRoot: string;
  databaseBackupsRoot: string;
  libraryMaterialsRoot: string;
  libraryCharactersRoot: string;
  libraryScenesRoot: string;
  libraryPropsRoot: string;
  libraryBgmRoot: string;
  libraryVoicesRoot: string;
  libraryEffectsRoot: string;
  librarySubtitlesRoot: string;
  libraryTemplatesRoot: string;
  configRoot: string;
}
