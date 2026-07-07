import type { LibraryItemRow } from "@/database/repositories/resource-center/phase3-interfaces";
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { getResourceCenterPhase3Repos } from "@/database/repositories/resource-center";

import { BaseLibrary } from "../libraries/base-library";
import type {
  LibraryDefinition,
  LibraryListQuery,
  LibraryListResult,
  ResourceItemMeta,
} from "../types";

function toMeta(row: LibraryItemRow): ResourceItemMeta {
  return {
    id: row.id,
    libraryId: row.library_id as ResourceItemMeta["libraryId"],
    title: row.title,
    category: row.category,
    tags: row.tags,
    enabled: row.enabled,
    favorite: row.favorite,
    rating: row.rating ?? undefined,
    thumbnailUrl: row.thumbnail_path ? `/api/files/${encodeURI(row.thumbnail_path.replace(/^.*storage\//, "storage/"))}` : undefined,
    previewUrl: row.preview_path ? `/api/files/${encodeURI(row.preview_path.replace(/^.*storage\//, "storage/"))}` : undefined,
    fileUrl: row.local_path ? `/api/files/${encodeURI(row.local_path.replace(/^.*storage\//, "storage/"))}` : undefined,
    mimeType: row.mime_type || undefined,
    fileSize: row.file_size || undefined,
    updatedAt: row.updated_at,
  };
}

/** Phase 3 — 从 resource_library_items 读取入库资源 */
export class StoredLibrary extends BaseLibrary {
  constructor(definition: LibraryDefinition) {
    super(definition);
  }

  override async list(query?: LibraryListQuery): Promise<LibraryListResult> {
    const repos = getResourceCenterPhase3Repos();
    const page = await repos.libraryItem.list(DEFAULT_WORKSPACE_ID, {
      library_id: this.definition.id,
      category: query?.category,
      tag: query?.tag,
      q: query?.q,
      enabled: query?.enabled,
      favorite: query?.favorite,
      limit: query?.limit ?? 50,
      offset: query?.offset ?? 0,
      sort: "recent",
    });
    const stats = await this.getStats();
    return {
      items: page.items.map(toMeta),
      total: page.total,
      stats: {
        ...stats,
        resourceCount: Math.max(stats.resourceCount, page.total),
        enabledCount: page.items.filter((i) => i.enabled).length,
      },
    };
  }

  override async getById(id: string): Promise<ResourceItemMeta | null> {
    const row = await getResourceCenterPhase3Repos().libraryItem.findById(id);
    if (!row || row.library_id !== this.definition.id) return null;
    return toMeta(row);
  }
}
