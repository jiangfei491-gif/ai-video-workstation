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

const BASE = "https://api.jamendo.com/v3.0";

/** Client ID：source.metadata.api_key 优先，其次 env JAMENDO_CLIENT_ID */
function readClientId(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.JAMENDO_CLIENT_ID)?.trim() || undefined;
}

type JamendoTrack = {
  id: string;
  name?: string;
  artist_name?: string;
  duration?: number;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  shareurl?: string;
  image?: string;
  license_ccurl?: string;
};

function mapTrack(t: JamendoTrack): CrawlerResourceItem {
  const lic = fromCcUrl(t.license_ccurl);
  return {
    externalId: String(t.id),
    title: t.artist_name ? `${t.artist_name} - ${t.name ?? t.id}` : (t.name ?? String(t.id)),
    detailUrl: t.shareurl,
    downloadUrl: t.audiodownload || t.audio || "",
    metadata: {
      artist: t.artist_name,
      duration: t.duration,
      downloadAllowed: t.audiodownload_allowed,
      cover: t.image,
      license: lic.license,
      commercial: lic.commercial,
    },
  };
}

/** Jamendo — 免费音乐（需 Client ID；返回可下载音频） */
export class JamendoCrawlerProvider implements CrawlerProvider {
  readonly slug = "jamendo";
  readonly label = "Jamendo";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const cid = readClientId(source);
    if (!cid) return { ok: false, message: "未配置 Jamendo Client ID（JAMENDO_CLIENT_ID）" };
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/tracks/?client_id=${cid}&format=json&limit=1`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = (await res.json().catch(() => ({}))) as { headers?: { status?: string } };
      const ok = res.ok && data.headers?.status === "success";
      return {
        ok,
        latencyMs: Date.now() - t0,
        statusCode: res.status,
        message: ok ? `连接成功 HTTP ${res.status}` : `连接失败（检查 Client ID）HTTP ${res.status}`,
      };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, message: `连接失败: ${(e as Error).message}` };
    }
  }

  async listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult> {
    const cid = readClientId(source);
    if (!cid) throw new Error("未配置 Jamendo Client ID（JAMENDO_CLIENT_ID）");
    const limit = Math.min(200, params.pageSize);
    const url = new URL(`${BASE}/tracks/`);
    url.searchParams.set("client_id", cid);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String((params.page - 1) * params.pageSize));
    url.searchParams.set("include", "musicinfo");
    url.searchParams.set("audiodlformat", "mp32");
    if (params.query) url.searchParams.set("search", params.query);
    else url.searchParams.set("order", "popularity_total");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    const data = (await res.json()) as { headers?: { results_count?: number }; results?: JamendoTrack[] };
    const items = (data.results ?? [])
      .map(mapTrack)
      .filter((i) => i.downloadUrl)
      // 只保留可商用（排除 CC-NC）
      .filter((i) => isCommercialOk((i.metadata as { commercial?: never })?.commercial ?? "unknown"));
    const returned = data.headers?.results_count ?? items.length;
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: returned >= limit ? params.page + 1 : params.page,
      hasMore: returned >= limit,
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const cid = readClientId(source);
    if (cid) {
      const res = await fetch(`${BASE}/tracks/?client_id=${cid}&format=json&id=${externalId}&audiodlformat=mp32`, {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: JamendoTrack[] };
        const t = data.results?.[0];
        if (t) return { item: mapTrack(t) };
      }
    }
    return { item: { externalId, title: externalId } };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    if (!item.downloadUrl) throw new Error("该曲目不可下载");
    return { downloadUrl: item.downloadUrl, filename: `${externalId}.mp3` };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
