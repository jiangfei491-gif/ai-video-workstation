/** 迁移用固定 ID（幂等） */
export const DEFAULT_USER_ID = "00000000-0000-4000-a000-000000000001";
export const DEFAULT_WORKSPACE_ID = "00000000-0000-4000-a000-000000000002";
export const DEFAULT_PROJECT_ID = "00000000-0000-4000-a000-000000000003";
export const DEFAULT_PROJECT_SLUG = "legacy-import";

export const LIBRARY_JSON_FILES = [
  "materials.json",
  "characters.json",
  "scenes.json",
  "props.json",
  "image-assets.json",
  "material-schedules.json",
  "shot-locks.json",
  "auto-edit-jobs.json",
  "script-evolution-runs.json",
  "script-evolution-script-records.json",
  "script-evolution-score-records.json",
] as const;

export const LEGACY_MEDIA_MAP = {
  Images: "images",
  Videos: "videos",
  Audio: "audio",
  BGM: "bgm-library",
} as const;
