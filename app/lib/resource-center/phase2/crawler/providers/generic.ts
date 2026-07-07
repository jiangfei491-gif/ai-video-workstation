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

async function headOrGet(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; ms: number }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch {
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
      return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
    } catch {
      return { ok: false, status: 0, ms: Date.now() - t0 };
    }
  }
}

function pickArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["items", "data", "results", "records"]) {
      if (Array.isArray(o[k])) return o[k] as unknown[];
    }
  }
  return [];
}

function mapGenericItem(raw: unknown, index: number): CrawlerResourceItem {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = String(o.id ?? o.slug ?? o.uuid ?? `item-${index}`);
  return {
    externalId: id,
    title: String(o.title ?? o.name ?? o.label ?? id),
    detailUrl: String(o.url ?? o.link ?? o.detail_url ?? ""),
    downloadUrl: String(o.download_url ?? o.downloadUrl ?? o.file_url ?? ""),
    updatedAt: String(o.updated_at ?? o.updatedAt ?? ""),
    metadata: o,
  };
}

/** 通用 HTTP/API Provider — 不针对特定网站 */
export class GenericHttpCrawlerProvider implements CrawlerProvider {
  readonly slug = "generic-http";
  readonly label = "Generic HTTP/API";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const target = source.api_url?.trim() || source.url?.trim();
    if (!target) return { ok: false, message: "未配置 url 或 api_url" };
    const r = await headOrGet(target);
    return {
      ok: r.ok,
      latencyMs: r.ms,
      statusCode: r.status,
      message: r.ok ? `连接成功 HTTP ${r.status}` : `连接失败 HTTP ${r.status || "timeout"}`,
    };
  }

  async listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult> {
    const base = source.api_url?.trim() || source.url?.trim();
    if (!base) {
      return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    }
    const url = new URL(base, base.startsWith("http") ? undefined : "https://example.com");
    url.searchParams.set("page", String(params.page));
    url.searchParams.set("limit", String(params.pageSize));
    if (params.query) url.searchParams.set("q", params.query);

    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
      }
      const data = (await res.json()) as unknown;
      const arr = pickArray(data).slice(0, params.pageSize);
      const items = arr.map(mapGenericItem);
      return {
        items,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: items.length < params.pageSize ? params.page : params.page + 1,
        hasMore: items.length >= params.pageSize,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    }
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const base = source.api_url?.trim() || source.url?.trim();
    const detailUrl = base ? `${base.replace(/\/$/, "")}/${externalId}` : externalId;
    try {
      const res = await fetch(detailUrl, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        return { item: mapGenericItem(data, 0) };
      }
    } catch {
      /* fallback */
    }
    return {
      item: { externalId, title: externalId, detailUrl },
    };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const detail = await this.getDetail(source, externalId);
    const url = detail.item.downloadUrl || detail.item.detailUrl || source.url;
    return {
      downloadUrl: url,
      filename: `${externalId}.bin`,
    };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}

/** 通用 RSS Provider */
export class GenericRssCrawlerProvider implements CrawlerProvider {
  readonly slug = "generic-rss";
  readonly label = "Generic RSS";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const target = source.rss_url?.trim() || source.url?.trim();
    if (!target) return { ok: false, message: "未配置 rss_url" };
    const r = await headOrGet(target);
    return {
      ok: r.ok,
      latencyMs: r.ms,
      statusCode: r.status,
      message: r.ok ? "RSS 可达" : "RSS 不可达",
    };
  }

  async listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult> {
    const feedUrl = source.rss_url?.trim();
    if (!feedUrl) {
      return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    }
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) });
      const xml = await res.text();
      const items = parseRssItems(xml).slice(
        (params.page - 1) * params.pageSize,
        params.page * params.pageSize
      );
      return {
        items,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: items.length < params.pageSize ? params.page : params.page + 1,
        hasMore: items.length >= params.pageSize,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    }
  }

  async getDetail(_source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    return { item: { externalId, title: externalId } };
  }

  async getDownloadUrl(_source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    return { downloadUrl: externalId, filename: pathBasename(externalId) };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    const all = await this.listResources(source, { page: 1, pageSize: 200 });
    const q = query.toLowerCase();
    const filtered = all.items.filter((i) => i.title.toLowerCase().includes(q));
    const start = (params.page - 1) * params.pageSize;
    const items = filtered.slice(start, start + params.pageSize);
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(filtered.length / params.pageSize) || 1,
      hasMore: start + params.pageSize < filtered.length,
    };
  }
}

function pathBasename(u: string): string {
  try {
    const p = new URL(u).pathname;
    return p.split("/").filter(Boolean).pop() ?? "download.bin";
  } catch {
    return "download.bin";
  }
}

function parseRssItems(xml: string): CrawlerResourceItem[] {
  const items: CrawlerResourceItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const guid = extractTag(block, "guid") || link || title;
    const pubDate = extractTag(block, "pubDate");
    if (!guid) continue;
    items.push({
      externalId: guid,
      title: title || guid,
      detailUrl: link,
      downloadUrl: link,
      updatedAt: pubDate,
    });
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim();
}
