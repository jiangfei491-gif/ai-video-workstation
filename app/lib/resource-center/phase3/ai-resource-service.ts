import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { getResourceCenterPhase3Repos } from "@/database/repositories/resource-center";
import type {
  LibraryItemQuery,
  LibraryItemRow,
} from "@/database/repositories/resource-center/phase3-interfaces";

import { LIBRARY_IDS } from "../libraries/definitions";
import type { LibraryId } from "../types";
import type { ResourceSearchQuery, ResourceSearchResult, ResourceServiceItem } from "./types";

function toServiceItem(row: LibraryItemRow): ResourceServiceItem {
  return {
    id: row.id,
    libraryId: row.library_id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags,
    keywords: row.keywords,
    language: row.language,
    style: row.style,
    mood: row.mood,
    purpose: row.purpose,
    platform: row.platform,
    rating: row.rating,
    qualityScore: row.quality_score,
    enabled: row.enabled,
    favorite: row.favorite,
    localPath: row.local_path,
    thumbnailPath: row.thumbnail_path,
    previewPath: row.preview_path,
    sha256: row.sha256,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    updatedAt: row.updated_at,
  };
}

function toRepoQuery(q: ResourceSearchQuery): LibraryItemQuery {
  return {
    library_id: q.libraryId,
    category: q.category,
    tag: q.tag,
    keyword: q.keyword,
    style: q.style,
    mood: q.mood,
    language: q.language,
    platform: q.platform,
    q: q.q,
    min_rating: q.minRating,
    min_quality: q.minQuality,
    enabled: q.enabled,
    favorite: q.favorite,
    sort: q.sort === "random" ? "popular" : q.sort,
    limit: q.limit,
    offset: q.offset,
  };
}

/**
 * AI Resource Service — AI Video OS 唯一资源调用接口
 * 各 Center / Agent / OpenCut / QA 须经此服务获取资源，禁止直接访问 Library 磁盘。
 */
export class AIResourceService {
  private readonly repos = getResourceCenterPhase3Repos();

  async search(
    query: ResourceSearchQuery,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceSearchResult> {
    const repoQuery = toRepoQuery(query);
    let page = await this.repos.libraryItem.list(DEFAULT_WORKSPACE_ID, repoQuery);

    if (query.sort === "random" && page.items.length > 1) {
      page = {
        ...page,
        items: [...page.items].sort(() => Math.random() - 0.5),
      };
    }

    if (caller?.moduleId) {
      await this.repos.libraryItem.recordAccess(DEFAULT_WORKSPACE_ID, {
        module_id: caller.moduleId,
        module_label: caller.moduleLabel,
        query: query as Record<string, unknown>,
        result_count: page.items.length,
      });
    }

    return {
      items: page.items.map(toServiceItem),
      total: page.total,
    };
  }

  async getById(
    libraryId: LibraryId | string,
    itemId: string,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceServiceItem | null> {
    const row = await this.repos.libraryItem.findById(itemId);
    if (!row || row.library_id !== libraryId || row.deleted_at) return null;

    if (caller?.moduleId) {
      await this.repos.libraryItem.recordAccess(DEFAULT_WORKSPACE_ID, {
        module_id: caller.moduleId,
        module_label: caller.moduleLabel,
        query: { libraryId, itemId },
        result_count: 1,
      });
    }

    return toServiceItem(row);
  }

  async recommendBest(
    libraryId: LibraryId | string,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceServiceItem | null> {
    const page = await this.search(
      { libraryId, sort: "quality", limit: 1, enabled: true },
      caller
    );
    return page.items[0] ?? null;
  }

  async recommendSimilar(
    itemId: string,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceSearchResult> {
    const similar = await this.repos.libraryItem.findSimilar(itemId, 12);
    if (caller?.moduleId) {
      await this.repos.libraryItem.recordAccess(DEFAULT_WORKSPACE_ID, {
        module_id: caller.moduleId,
        module_label: caller.moduleLabel,
        query: { similarTo: itemId },
        result_count: similar.length,
      });
    }
    return {
      items: similar.map(toServiceItem),
      total: similar.length,
    };
  }

  async getRecent(
    libraryId?: LibraryId | string,
    limit = 20,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceSearchResult> {
    return this.search({ libraryId, sort: "recent", limit, enabled: true }, caller);
  }

  async getPopular(
    libraryId?: LibraryId | string,
    limit = 20,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceSearchResult> {
    return this.search({ libraryId, sort: "popular", limit, enabled: true }, caller);
  }

  async randomRecommend(
    libraryId?: LibraryId | string,
    limit = 10,
    caller?: { moduleId: string; moduleLabel?: string }
  ): Promise<ResourceSearchResult> {
    return this.search({ libraryId, sort: "random", limit, enabled: true }, caller);
  }

  supportedLibraries(): LibraryId[] {
    return [...LIBRARY_IDS];
  }
}

let singleton: AIResourceService | null = null;

export function getAIResourceService(): AIResourceService {
  if (!singleton) singleton = new AIResourceService();
  return singleton;
}
