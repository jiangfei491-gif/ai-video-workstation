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

function readKey(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.PIXABAY_API_KEY)?.trim() || undefined;
}

/** 视频库走 /api/videos/，其余走 /api/（图片） */
function isVideo(source: ResourceSourceRow): boolean {
  return (source.resource_types ?? []).includes("video");
}

type PixabayVideoFile = { url?: string; width?: number; height?: number; size?: number };
type PixabayVideoHit = {
  id: number;
  tags?: string;
  duration?: number;
  pageURL?: string;
  videos?: Record<string, PixabayVideoFile>;
};
type PixabayImageHit = {
  id: number;
  tags?: string;
  pageURL?: string;
  largeImageURL?: string;
  webformatURL?: string;
};

/** Pixabay — 免费视频 / 图片（需免费 API key；无音乐 API） */
export class PixabayCrawlerProvider implements CrawlerProvider {
  readonly slug = "pixabay";
  readonly label = "Pixabay";

  private endpoint(source: ResourceSourceRow): string {
    return isVideo(source) ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  }

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const key = readKey(source);
    if (!key) return { ok: false, message: "未配置 Pixabay API key（PIXABAY_API_KEY）" };
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.endpoint(source)}?key=${key}&q=nature&per_page=3`, {
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
    if (!key) throw new Error("未配置 Pixabay API key（PIXABAY_API_KEY）");
    const url = new URL(this.endpoint(source));
    url.searchParams.set("key", key);
    url.searchParams.set("per_page", String(Math.min(200, Math.max(3, params.pageSize))));
    url.searchParams.set("page", String(params.page));
    if (params.query) url.searchParams.set("q", params.query);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    const data = (await res.json()) as { totalHits?: number; hits?: unknown[] };
    const video = isVideo(source);
    const items: CrawlerResourceItem[] = (data.hits ?? []).map((raw) =>
      video ? mapVideo(raw as PixabayVideoHit) : mapImage(raw as PixabayImageHit)
    );
    const totalHits = data.totalHits ?? items.length;
    const totalPages = Math.max(1, Math.ceil(totalHits / params.pageSize));
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
      const res = await fetch(`${this.endpoint(source)}?key=${key}&id=${externalId}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { hits?: unknown[] };
        const hit = data.hits?.[0];
        if (hit) return { item: isVideo(source) ? mapVideo(hit as PixabayVideoHit) : mapImage(hit as PixabayImageHit) };
      }
    }
    return { item: { externalId, title: externalId } };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    if (!item.downloadUrl) throw new Error("无可用下载链");
    const ext = isVideo(source) ? "mp4" : "jpg";
    return { downloadUrl: item.downloadUrl, filename: `${externalId}.${ext}` };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}

function mapVideo(h: PixabayVideoHit): CrawlerResourceItem {
  const v = h.videos ?? {};
  const file = v.large || v.medium || v.small || v.tiny;
  return {
    externalId: String(h.id),
    title: h.tags || `video-${h.id}`,
    detailUrl: h.pageURL,
    downloadUrl: file?.url ?? "",
    metadata: { duration: h.duration, width: file?.width, height: file?.height, sizeBytes: file?.size, license: "Pixabay Content License", commercial: "safe" },
  };
}

function mapImage(h: PixabayImageHit): CrawlerResourceItem {
  return {
    externalId: String(h.id),
    title: h.tags || `image-${h.id}`,
    detailUrl: h.pageURL,
    downloadUrl: h.largeImageURL || h.webformatURL || "",
    metadata: { license: "Pixabay Content License", commercial: "safe" },
  };
}
