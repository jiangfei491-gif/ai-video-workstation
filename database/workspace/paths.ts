/**
 * AI Video OS — Workspace V2 路径常量
 *
 * 所有路径相对于 workspaceRoot。禁止硬编码绝对路径。
 */

export const WORKSPACE_VERSION = 2;

export const DEFAULT_WORKSPACE_DIR_NAME = "AI Video OS";

/** 工作区顶层 */
export const WORKSPACE_TOP_LEVEL = {
  database: "database",
  storage: "storage",
  models: "models",
  logs: "logs",
  backups: "backups",
  config: "config",
  plugins: "plugins",
  scripts: "scripts",
  templates: "templates",
  workspaceJson: "workspace.json",
} as const;

/** storage 子目录 */
export const STORAGE_REL = {
  projects: "storage/projects",
  library: "storage/library",
  cache: "storage/cache",
  temp: "storage/temp",
  exports: "storage/exports",
  downloads: "storage/downloads",
} as const;

/** library 子目录 */
export const LIBRARY_REL = {
  materials: "materials",
  characters: "characters",
  scenes: "scenes",
  props: "props",
  bgm: "bgm",
  sfx: "sfx",
  voices: "voices",
  subtitleStyles: "subtitle-styles",
  effects: "effects",
  transitions: "transitions",
  templates: "templates",
  prompts: "prompts",
  lora: "lora",
  fonts: "fonts",
  stickers: "stickers",
  overlays: "overlays",
  logos: "logos",
  watermarks: "watermarks",
} as const;

/** Resource Center V1 — 12 大内容库（storage/library/ 下） */
export const RESOURCE_CENTER_LIBRARY_REL = {
  image: "image",
  video: "video",
  music: "music",
  sfx: "sfx",
  voice: "voice",
  subtitle: "subtitle",
  effect: "effect",
  prompt: "prompt",
  character: "character",
  lora: "lora",
  brand: "brand",
  dataset: "dataset",
} as const;

/** models 子目录 */
export const MODEL_REL = {
  openai: "openai",
  claude: "claude",
  gemini: "gemini",
  deepseek: "deepseek",
  flux: "flux",
  comfyui: "comfyui",
  whisper: "whisper",
  fishspeech: "fishspeech",
  cosyvoice: "cosyvoice",
  f5tts: "f5tts",
  llama: "llama",
  qwen: "qwen",
  custom: "custom",
} as const;

/** database 子目录 */
export const DATABASE_REL = {
  postgres: "postgres",
  migrations: "migrations",
  backups: "backups",
  runtime: "runtime",
} as const;

/** 项目子目录 */
export const PROJECT_REL = {
  images: "images",
  videos: "videos",
  audio: "audio",
  subtitle: "subtitle",
  music: "music",
  effects: "effects",
  renders: "renders",
  exports: "exports",
  thumbnails: "thumbnails",
  metadata: "metadata",
  opencut: "opencut",
  cache: "cache",
  temp: "temp",
  director: "director",
  timeline: "timeline",
  qa: "qa",
  voice: "voice",
  subtitleJson: "subtitle-json",
} as const;

/** @deprecated V1 兼容别名 */
export const WORKSPACE_REL_PATHS = {
  database: WORKSPACE_TOP_LEVEL.database,
  databasePostgres: `${WORKSPACE_TOP_LEVEL.database}/${DATABASE_REL.postgres}`,
  databaseMigrations: `${WORKSPACE_TOP_LEVEL.database}/${DATABASE_REL.migrations}`,
  databaseBackups: `${WORKSPACE_TOP_LEVEL.database}/${DATABASE_REL.backups}`,
  storage: WORKSPACE_TOP_LEVEL.storage,
  storageProjects: STORAGE_REL.projects,
  storageLibrary: STORAGE_REL.library,
  storageLibraryMaterials: `${STORAGE_REL.library}/${LIBRARY_REL.materials}`,
  storageLibraryCharacters: `${STORAGE_REL.library}/${LIBRARY_REL.characters}`,
  storageLibraryScenes: `${STORAGE_REL.library}/${LIBRARY_REL.scenes}`,
  storageLibraryProps: `${STORAGE_REL.library}/${LIBRARY_REL.props}`,
  storageLibraryBgm: `${STORAGE_REL.library}/${LIBRARY_REL.bgm}`,
  storageLibraryVoices: `${STORAGE_REL.library}/${LIBRARY_REL.voices}`,
  storageLibraryEffects: `${STORAGE_REL.library}/${LIBRARY_REL.effects}`,
  storageLibrarySubtitles: `${STORAGE_REL.library}/${LIBRARY_REL.subtitleStyles}`,
  storageLibraryTemplates: `${STORAGE_REL.library}/${LIBRARY_REL.templates}`,
  storageCache: STORAGE_REL.cache,
  storageTemp: STORAGE_REL.temp,
  storageExports: STORAGE_REL.exports,
  models: WORKSPACE_TOP_LEVEL.models,
  logs: WORKSPACE_TOP_LEVEL.logs,
  backups: WORKSPACE_TOP_LEVEL.backups,
  config: WORKSPACE_TOP_LEVEL.config,
  plugins: WORKSPACE_TOP_LEVEL.plugins,
  scripts: WORKSPACE_TOP_LEVEL.scripts,
  templates: WORKSPACE_TOP_LEVEL.templates,
} as const;

export const PROJECT_REL_PATHS = PROJECT_REL;

export const WORKSPACE_CONFIG_FILE = "workspace.json";

import path from "node:path";

export function libraryPath(workspaceRoot: string, key: keyof typeof LIBRARY_REL): string {
  return path.join(workspaceRoot, STORAGE_REL.library, LIBRARY_REL[key]);
}

export function resourceCenterLibraryPath(
  workspaceRoot: string,
  key: keyof typeof RESOURCE_CENTER_LIBRARY_REL
): string {
  return path.join(workspaceRoot, STORAGE_REL.library, RESOURCE_CENTER_LIBRARY_REL[key]);
}

export function modelPath(workspaceRoot: string, key: keyof typeof MODEL_REL): string {
  return path.join(workspaceRoot, WORKSPACE_TOP_LEVEL.models, MODEL_REL[key]);
}
