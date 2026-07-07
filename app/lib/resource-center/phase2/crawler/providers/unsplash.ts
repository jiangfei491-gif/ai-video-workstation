import type { ResourceSourceRow } from "@/database/repositories/resource-center/interfaces";

import type {
  ConnectionTestResult,
  CrawlerDetailResult,
  CrawlerDownloadUrlResult,
  CrawlerListParams,
  CrawlerListResult,
  CrawlerProvider,
  CrawlerResourceItem,
} from "../provider";

const BASE = "https://api.unsplash.com";

/** Access Key：source.metadata.api_key 优先，其次 env UNSPLASH_ACCESS_KEY */
function readKey(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.UNSPLASH_ACCESS_KEY)?.trim() || undefined;
}

type UnsplashPhoto = {
  id: string;
  description?: string | null;
  alt_description?: string | null;
  urls?: { raw?: string; full?: string; regular?: string };
  links?: { html?: string; download?: string };
  user?: { name?: string };
};

function mapPhoto(p: UnsplashPhoto): CrawlerResourceItem {
  return {
    externalId: p.id,
    title: p.description || p.alt_description || p.id,
    detailUrl: p.links?.html,
    downloadUrl: p.urls?.full || p.urls?.regular || "",
    metadata: { author: p.user?.name, attribution: p.links?.html, license: "Unsplash License", commercial: "safe" },
  };
}

/** Unsplash — 免费图片（需 Access Key） */
export class UnsplashCrawlerProvider implements CrawlerProvider {
  readonly slug = "unsplash";
  readonly label = "Unsplash";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const key = readKey(source);
    if (!key) return { ok: false, message: "未配置 Unsplash Access Key（UNSPLASH_ACCESS_KEY）" };
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/photos?per_page=1&client_id=${key}`, {
        signal: AbortSignal.timeout(10000),
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - t0,
        statusCode: res.status,
        message: res.ok ? `连接成功 HTTP ${res.status}` : `连接失败 HTTP ${res.status}（检查 key）`,
      };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, message: `连接失败: ${(e as Error).message}` };
    }
  }

  async listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult> {
    const key = readKey(source);
    if (!key) throw new Error("未配置 Unsplash Access Key（UNSPLASH_ACCESS_KEY）");
    const perPage = Math.min(30, params.pageSize);

    let items: CrawlerResourceItem[] = [];
    let totalPages = params.page;
    if (params.query) {
      const url = new URL(`${BASE}/search/photos`);
      url.searchParams.set("query", params.query);
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(params.page));
      url.searchParams.set("client_id", key);
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
      const data = (await res.json()) as { results?: UnsplashPhoto[]; total_pages?: number };
      items = (data.results ?? []).map(mapPhoto);
      totalPages = data.total_pages ?? params.page;
    } else {
      const url = new URL(`${BASE}/photos`);
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(params.page));
      url.searchParams.set("client_id", key);
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
      const data = (await res.json()) as UnsplashPhoto[];
      items = data.map(mapPhoto);
      totalPages = items.length < perPage ? params.page : params.page + 1;
    }

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages,
      hasMore: params.page < totalPages,
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const key = readKey(source);
    if (key) {
      const res = await fetch(`${BASE}/photos/${externalId}?client_id=${key}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { item: mapPhoto((await res.json()) as UnsplashPhoto) };
    }
    return { item: { externalId, title: externalId } };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    return {
      downloadUrl: item.downloadUrl || `https://unsplash.com/photos/${externalId}/download`,
      filename: `${externalId}.jpg`,
    };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
