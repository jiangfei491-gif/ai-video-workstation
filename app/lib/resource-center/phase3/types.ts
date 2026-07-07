import type { LibraryId } from "../types";
import type { AnalysisResultPayload } from "@/database/repositories/resource-center/phase3-interfaces";

export type { AnalysisResultPayload };

export type AnalyzerInput = {
  filename: string;
  localPath: string;
  mimeType: string;
  fileSize: number;
  sha256?: string | null;
  sourceResourceTypes?: string[];
  sourceCategory?: string;
  sourceLanguage?: string;
  remoteUrl?: string;
  metadata?: Record<string, unknown>;
};

export type ResourceSearchQuery = {
  libraryId?: LibraryId | string;
  category?: string;
  tag?: string;
  keyword?: string;
  style?: string;
  mood?: string;
  language?: string;
  platform?: string;
  q?: string;
  minRating?: number;
  minQuality?: number;
  enabled?: boolean;
  favorite?: boolean;
  sort?: "recent" | "rating" | "quality" | "popular" | "random";
  limit?: number;
  offset?: number;
};

export type ResourceServiceItem = {
  id: string;
  libraryId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  keywords: string[];
  language: string;
  style: string;
  mood: string;
  purpose: string;
  platform: string;
  rating: number | null;
  qualityScore: number | null;
  enabled: boolean;
  favorite: boolean;
  localPath: string;
  thumbnailPath: string;
  previewPath: string;
  sha256: string | null;
  fileSize: number;
  mimeType: string;
  updatedAt: string;
};

export type ResourceSearchResult = {
  items: ResourceServiceItem[];
  total: number;
};

export const EXT_LIBRARY_HINT: Record<string, LibraryId> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  mp3: "music",
  wav: "music",
  flac: "music",
  ogg: "music",
  m4a: "music",
  srt: "subtitle",
  ass: "subtitle",
  vtt: "subtitle",
  txt: "prompt",
  md: "prompt",
  json: "prompt",
  safetensors: "lora",
  ckpt: "lora",
  csv: "dataset",
  zip: "dataset",
};

export function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    flac: "audio/flac",
    ogg: "audio/ogg",
    srt: "text/plain",
    ass: "text/plain",
    vtt: "text/vtt",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
  };
  return map[ext] ?? "application/octet-stream";
}

export function guessLibraryFromFilename(filename: string): LibraryId {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LIBRARY_HINT[ext] ?? "image";
}

export function mapSourceTypesToLibrary(types: string[]): LibraryId | null {
  const order: LibraryId[] = [
    "video",
    "image",
    "music",
    "sfx",
    "voice",
    "subtitle",
    "effect",
    "prompt",
    "character",
    "lora",
    "dataset",
  ];
  for (const lib of order) {
    if (types.includes(lib)) return lib;
  }
  if (types.includes("audio")) return "music";
  if (types.includes("bgm")) return "music";
  return null;
}
