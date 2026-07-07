import type { LibraryDbMapping, LibraryId } from "./types";
import { LIBRARY_BY_ID } from "./libraries/definitions";

export function getLibraryDbMapping(libraryId: LibraryId): LibraryDbMapping {
  return LIBRARY_BY_ID[libraryId].dbMapping;
}

/** Resource Center V1 — 只读映射至现有 PostgreSQL 表（不改 Schema） */
export const RESOURCE_CENTER_DB_INDEX: Record<
  LibraryId,
  {
    primaryTable: string;
    indexHints: string[];
    views?: string[];
  }
> = {
  image: {
    primaryTable: "assets",
    views: ["image_assets", "thumbnail_assets"],
    indexHints: ["assets(workspace_id, kind)", "assets(deleted_at)"],
  },
  video: {
    primaryTable: "assets",
    views: ["video_assets"],
    indexHints: ["assets(workspace_id, kind)"],
  },
  music: {
    primaryTable: "music_library",
    indexHints: ["music_library(workspace_id)", "assets(kind) WHERE kind IN ('bgm','audio')"],
  },
  sfx: {
    primaryTable: "assets",
    views: ["audio_assets"],
    indexHints: ["assets(workspace_id, kind)"],
  },
  voice: {
    primaryTable: "voice_library",
    indexHints: ["voice_library(workspace_id, provider_slug)"],
  },
  subtitle: {
    primaryTable: "subtitle_library",
    indexHints: ["subtitle_library(workspace_id, kind)"],
  },
  effect: {
    primaryTable: "effects_library",
    indexHints: ["effects_library(workspace_id, kind)"],
  },
  prompt: {
    primaryTable: "prompts",
    indexHints: ["prompts(workspace_id)", "templates(template_kind)"],
  },
  character: {
    primaryTable: "characters",
    indexHints: ["characters(workspace_id, name)", "project_resources(resource_type)"],
  },
  lora: {
    primaryTable: "templates",
    indexHints: ["templates(workspace_id, template_kind)"],
  },
  dataset: {
    primaryTable: "glossaries",
    indexHints: ["glossaries(workspace_id)", "glossary_entries(glossary_id)"],
  },
};

export function listAllDbMappings(): Array<{ libraryId: LibraryId; mapping: LibraryDbMapping }> {
  return (Object.keys(LIBRARY_BY_ID) as LibraryId[]).map((libraryId) => ({
    libraryId,
    mapping: LIBRARY_BY_ID[libraryId].dbMapping,
  }));
}
