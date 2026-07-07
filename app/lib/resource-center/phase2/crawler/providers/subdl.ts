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

const API_BASE = "https://api.subdl.com/api/v1/subtitles";
const DL_BASE = "https://dl.subdl.com";

function readKey(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.SUBDL_API_KEY)?.trim() || undefined;
}

/** 字幕按影片检索：无 query 时用来源默认词（或宽泛热门词） */
function defaultQuery(source: ResourceSourceRow): string {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.default_query as string) || "").trim() || "Interstellar";
}

function languages(source: ResourceSourceRow): string {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.languages as string) || "").trim() || "EN,ZH";
}

type SubdlSubtitle = {
  release_name?: string;
  name?: string;
  lang?: string;
  language?: string;
  author?: string;
  url?: string;
  subtitlePage?: string;
  season?: number | null;
  episode?: number | null;
};

/** 从 url 路径提取稳定 id，如 /subtitle/3467330-8390389.zip?... → 3467330-8390389 */
function idFromUrl(url: string): string {
  const m = /\/subtitle\/([^/?.]+)/.exec(url);
  return m?.[1] ?? url.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
}

function mapSubtitle(s: SubdlSubtitle): CrawlerResourceItem {
  const url = s.url ?? "";
  const id = idFromUrl(url);
  return {
    externalId: id,
    title: s.release_name || s.name || id,
    detailUrl: s.subtitlePage ? `${DL_BASE.replace("dl.", "")}${s.subtitlePage}` : undefined,
    downloadUrl: url ? `${DL_BASE}/subtitle/${id}.zip` : "",
    metadata: {
      language: s.language || s.lang,
      author: s.author,
      season: s.season ?? undefined,
      episode: s.episode ?? undefined,
    },
  };
}

/** subdl — 字幕下载（需 API key；按影片名检索，下载为 .zip 字幕包） */
export class SubdlCrawlerProvider implements CrawlerProvider {
  readonly slug = "subdl";
  readonly label = "subdl";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const key = readKey(source);
    if (!key) return { ok: false, message: "未配置 subdl API key（SUBDL_API_KEY）" };
    const t0 = Date.now();
    try {
      const res = await fetch(
        `${API_BASE}?api_key=${key}&film_name=Inception&languages=EN&subs_per_page=1`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = (await res.json().catch(() => ({}))) as { status?: boolean };
      const ok = res.ok && data.status === true;
      return {
        ok,
        latencyMs: Date.now() - t0,
        statusCode: res.status,
        message: ok ? `连接成功 HTTP ${res.status}` : `连接失败（检查 key）HTTP ${res.status}`,
      };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, message: `连接失败: ${(e as Error).message}` };
    }
  }

  async listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult> {
    const key = readKey(source);
    if (!key) throw new Error("未配置 subdl API key（SUBDL_API_KEY）");
    const url = new URL(API_BASE);
    url.searchParams.set("api_key", key);
    url.searchParams.set("film_name", params.query?.trim() || defaultQuery(source));
    url.searchParams.set("languages", languages(source));
    url.searchParams.set("subs_per_page", String(Math.min(30, params.pageSize)));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    const data = (await res.json()) as { status?: boolean; subtitles?: SubdlSubtitle[] };
    const items = (data.subtitles ?? []).map(mapSubtitle).filter((i) => i.downloadUrl);
    // subdl 字幕检索为单页返回（按影片），不做多页
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: params.page,
      hasMore: false,
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(_source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    return {
      item: {
        externalId,
        title: externalId,
        downloadUrl: `${DL_BASE}/subtitle/${externalId}.zip`,
      },
    };
  }

  async getDownloadUrl(_source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    return {
      downloadUrl: `${DL_BASE}/subtitle/${externalId}.zip`,
      filename: `${externalId}.zip`,
    };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
