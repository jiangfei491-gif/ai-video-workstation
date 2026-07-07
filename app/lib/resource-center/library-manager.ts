import fs from "node:fs";

import { getWorkspaceManager } from "@/database/workspace";

import { StoredLibrary } from "./phase3/stored-library";
import { LIBRARY_DEFINITIONS, LIBRARY_BY_ID, LIBRARY_IDS } from "./libraries/definitions";
import { resolveResourceCenterManifestPath } from "./paths";
import type {
  ILibrary,
  LibraryId,
  LibraryStats,
  ResourceCenterManifest,
} from "./types";

export class LibraryManager {
  private readonly libraries: Map<LibraryId, ILibrary>;

  constructor() {
    this.libraries = new Map(
      LIBRARY_DEFINITIONS.map((def) => [def.id, new StoredLibrary(def) as ILibrary])
    );
  }

  listLibraries(): ILibrary[] {
    return LIBRARY_IDS.map((id) => this.libraries.get(id)!);
  }

  getLibrary(id: LibraryId): ILibrary {
    const lib = this.libraries.get(id);
    if (!lib) throw new Error(`未知内容库: ${id}`);
    return lib;
  }

  hasLibrary(id: string): id is LibraryId {
    return id in LIBRARY_BY_ID;
  }

  ensureAllLayouts(): ResourceCenterManifest {
    getWorkspaceManager().ensureLayout();
    for (const lib of this.listLibraries()) {
      lib.ensureLayout();
    }
    const manifest: ResourceCenterManifest = {
      version: 1,
      libraryIds: [...LIBRARY_IDS],
      ensuredAt: new Date().toISOString(),
      workspaceRoot: getWorkspaceManager().workspaceRoot,
    };
    fs.writeFileSync(resolveResourceCenterManifestPath(), JSON.stringify(manifest, null, 2), "utf8");
    return manifest;
  }

  async getGlobalStats(): Promise<{
    totalLibraries: number;
    totalResources: number;
    totalDbRecords: number;
    byLibrary: Record<LibraryId, LibraryStats>;
  }> {
    const byLibrary = {} as Record<LibraryId, LibraryStats>;
    let totalResources = 0;
    let totalDbRecords = 0;
    for (const id of LIBRARY_IDS) {
      const stats = await this.getLibrary(id).getStats();
      byLibrary[id] = stats;
      totalResources += stats.resourceCount;
      totalDbRecords += stats.dbRecordCount;
    }
    return {
      totalLibraries: LIBRARY_IDS.length,
      totalResources,
      totalDbRecords,
      byLibrary,
    };
  }
}

let singleton: LibraryManager | null = null;

export function getLibraryManager(): LibraryManager {
  if (!singleton) singleton = new LibraryManager();
  return singleton;
}

export function resetLibraryManager(): void {
  singleton = null;
}
