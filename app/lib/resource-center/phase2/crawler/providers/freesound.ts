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
import { fromCcUrl, isCommercialOk } from "./license";

const BASE = "https://freesound.org/apiv2";
const FIELDS = "id,name,previews,type,duration,license,username";

/** Token：source.metadata.api_key 优先，其次 env FREESOUND_API_KEY */
function readToken(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.FREESOUND_API_KEY)?.trim() || undefined;
}

/** 默认检索词（Freesound 文本检索需要 query；无则用宽泛词或来源自定义） */
function defaultQuery(source: ResourceSourceRow): string {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.default_query as string) || "").trim() || "sound";
}

type FreesoundSound = {
  id: number;
  name?: string;
  type?: string;
  duration?: number;
  license?: string;
  username?: string;
  previews?: Record<string, string>;
};

function mapSound(s: FreesoundSound): CrawlerResourceItem {
  const hq = s.previews?.["preview-hq-mp3"] || s.previews?.["preview-lq-mp3"] || "";
  const lic = fromCcUrl(s.license); // Freesound 的 license 是 CC URL
  return {
    externalId: String(s.id),
    title: s.name ?? `sound-${s.id}`,
    detailUrl: `https://freesound.org/s/${s.id}/`,
    downloadUrl: hq,
    metadata: {
      type: s.type,
      duration: s.duration,
      author: s.username,
      license: lic.license,
      commercial: lic.commercial,
    },
  };
}

/** Freesound — 免费音效（token 认证；下载用 HQ 预览 mp3，原始文件需 OAuth2） */
export class FreesoundCrawlerProvider implements CrawlerProvider {
  readonly slug = "freesound";
  readonly label = "Freesound";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const token = readToken(source);
    if (!token) return { ok: false, message: "未配置 Freesound API key（FREESOUND_API_KEY）" };
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/search/text/?query=test&page_size=1&token=${token}`, {
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
    const token = readToken(source);
    if (!token) throw new Error("未配置 Freesound API key（FREESOUND_API_KEY）");
    const url = new URL(`${BASE}/search/text/`);
    url.searchParams.set("query", params.query?.trim() || defaultQuery(source));
    url.searchParams.set("page", String(params.page));
    url.searchParams.set("page_size", String(Math.min(150, params.pageSize)));
    url.searchParams.set("fields", FIELDS);
    url.searchParams.set("sort", "downloads_desc");
    // 只拉可商用授权：CC0 + Attribution（排除 NonCommercial）
    url.searchParams.set("filter", 'license:("Creative Commons 0" OR "Attribution")');
    url.searchParams.set("token", token);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    const data = (await res.json()) as { count?: number; next?: string | null; results?: FreesoundSound[] };
    const items = (data.results ?? [])
      .map(mapSound)
      .filter((i) => isCommercialOk((i.metadata as { commercial?: never })?.commercial ?? "unknown"));
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: data.count ? Math.ceil(data.count / params.pageSize) : params.page,
      hasMore: Boolean(data.next),
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const token = readToken(source);
    if (token) {
      const res = await fetch(`${BASE}/sounds/${externalId}/?fields=${FIELDS}&token=${token}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { item: mapSound((await res.json()) as FreesoundSound) };
    }
    return { item: { externalId, title: externalId, detailUrl: `https://freesound.org/s/${externalId}/` } };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    if (!item.downloadUrl) throw new Error("该音效无可用预览下载链");
    return { downloadUrl: item.downloadUrl, filename: `${externalId}.mp3` };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
