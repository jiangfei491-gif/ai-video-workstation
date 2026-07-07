import fs from "fs";
import path from "path";
import {
  libraryBgmDir,
  librarySfxDir,
  toWorkspaceFileUrl,
} from "@/app/lib/storage/workspace-paths";
import { getWorkspaceManager } from "@/database/workspace";
import type { BgmLibraryEntry } from "./types";

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg)$/i;

function listAudioInDir(dir: string, relPrefix: string, kind: BgmLibraryEntry["kind"]): BgmLibraryEntry[] {
  getWorkspaceManager().ensureLayout();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => AUDIO_EXT.test(name))
    .map((filename) => ({
      filename,
      url: toWorkspaceFileUrl(path.join(relPrefix, filename)),
      kind,
    }));
}

export function listBgmLibrary(): BgmLibraryEntry[] {
  return listAudioInDir(libraryBgmDir(), "BGM", "bgm");
}

export function listSfxLibrary(): BgmLibraryEntry[] {
  return listAudioInDir(librarySfxDir(), "Audio", "sfx");
}

export function listMusicLibrary(): BgmLibraryEntry[] {
  return [...listBgmLibrary(), ...listSfxLibrary()];
}

export function findLibraryEntryByFilename(filename: string): BgmLibraryEntry | undefined {
  const target = filename.trim().toLowerCase();
  return listMusicLibrary().find((e) => e.filename.toLowerCase() === target);
}

export function findLibraryEntryByUrl(url: string): BgmLibraryEntry | undefined {
  const norm = url.trim().toLowerCase();
  return listMusicLibrary().find((e) => e.url.toLowerCase() === norm);
}
