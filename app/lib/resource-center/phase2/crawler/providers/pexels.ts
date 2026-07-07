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

const BASE = "https://api.pexels.com";

function readKey(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.PEXELS_API_KEY)?.trim() || undefined;
}

/** image 库走图片，其余（effect / video）走视频 */
function usePhotos(source: ResourceSourceRow): boolean {
  return (source.resource_types ?? []).includes("image");
}

/** effect 特效库默认检索词（转场/叠加/光效类素材），可用 metadata.default_query 覆盖 */
function defaultQuery(source: ResourceSourceRow): string {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  const dq = (meta.default_query as string)?.trim();
  if (dq) return dq;
  // 默认不带检索词 → 走 popular 端点（稳定，且 popular 视频即可作特效/叠加素材）
  return "";
}

type PexelsVideoFile = { link?: string; quality?: string; width?: number; height?: number };
type PexelsVideo = { id: number; url?: string; duration?: number; image?: string; video_files?: PexelsVideoFile[] };
type PexelsPhoto = { id: number; url?: string; alt?: string; src?: { original?: string; large2x?: string } };

function bestVideoFile(files: PexelsVideoFile[] = []): PexelsVideoFile | undefined {
  return [...files].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
}

function mapVideo(v: PexelsVideo): CrawlerResourceItem {
  const f = bestVideoFile(v.video_files);
  return {
    externalId: String(v.id),
    title: v.url ? decodeURIComponent(v.url.split("/").filter(Boolean).pop() ?? String(v.id)) : String(v.id),
    detailUrl: v.url,
    downloadUrl: f?.link ?? "",
    metadata: { duration: v.duration, width: f?.width, height: f?.height, quality: f?.quality, cover: v.image, license: "Pexels License", commercial: "safe" },
  };
}

function mapPhoto(p: PexelsPhoto): CrawlerResourceItem {
  return {
    externalId: String(p.id),
    title: p.alt || String(p.id),
    detailUrl: p.url,
    downloadUrl: p.src?.original || p.src?.large2x || "",
    metadata: { license: "Pexels License", commercial: "safe" },
  };
}

/** Pexels — 免费视频/图片素材（需 API key）；effect 特效库用视频叠加/转场素材 */
export class PexelsCrawlerProvider implements CrawlerProvider {
  readonly slug = "pexels";
  readonly label = "Pexels";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const key = readKey(source);
    if (!key) return { ok: false, message: "未配置 Pexels API key（PEXELS_API_KEY）" };
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/videos/popular?per_page=1`, {
        headers: { Authorization: key },
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
    if (!key) throw new Error("未配置 Pexels API key（PEXELS_API_KEY）");
    const photos = usePhotos(source);
    const query = params.query?.trim() || defaultQuery(source);
    const perPage = Math.min(80, params.pageSize);

    let endpoint: string;
    if (photos) {
      endpoint = query ? `${BASE}/v1/search?query=${encodeURIComponent(query)}` : `${BASE}/v1/curated?`;
    } else {
      endpoint = query ? `${BASE}/videos/search?query=${encodeURIComponent(query)}` : `${BASE}/videos/popular?`;
    }
    const url = new URL(endpoint);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(params.page));

    const res = await fetch(url.toString(), { headers: { Authorization: key }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    const data = (await res.json()) as { photos?: PexelsPhoto[]; videos?: PexelsVideo[]; next_page?: string };
    const items = photos
      ? (data.photos ?? []).map(mapPhoto).filter((i) => i.downloadUrl)
      : (data.videos ?? []).map(mapVideo).filter((i) => i.downloadUrl);
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: data.next_page ? params.page + 1 : params.page,
      hasMore: Boolean(data.next_page),
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const key = readKey(source);
    if (key && !usePhotos(source)) {
      const res = await fetch(`${BASE}/videos/videos/${externalId}`, {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { item: mapVideo((await res.json()) as PexelsVideo) };
    }
    return { item: { externalId, title: externalId } };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    if (!item.downloadUrl) throw new Error("无可用下载链");
    const ext = usePhotos(source) ? "jpg" : "mp4";
    return { downloadUrl: item.downloadUrl, filename: `${externalId}.${ext}` };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
