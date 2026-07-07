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

const BASE = "https://huggingface.co/api";

/** 可选 token：source.metadata.api_key 或 HF_TOKEN（公开数据集无需） */
function authHeaders(source: ResourceSourceRow): Record<string, string> {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  const key = ((meta.api_key as string) || process.env.HF_TOKEN)?.trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/** 依据 source 类型决定抓 datasets / models */
function repoKind(source: ResourceSourceRow): "datasets" | "models" {
  const types = source.resource_types ?? [];
  return types.includes("dataset") ? "datasets" : "models";
}

type HfRepo = { id: string; downloads?: number; likes?: number; lastModified?: string };

/** HuggingFace — 数据集 / 模型索引（公开内容无需 token） */
export class HuggingFaceCrawlerProvider implements CrawlerProvider {
  readonly slug = "huggingface";
  readonly label = "HuggingFace";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/${repoKind(source)}?limit=1`, {
        headers: authHeaders(source),
        signal: AbortSignal.timeout(10000),
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - t0,
        statusCode: res.status,
        message: res.ok ? `连接成功 HTTP ${res.status}` : `连接失败 HTTP ${res.status}`,
      };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, message: `连接失败: ${(e as Error).message}` };
    }
  }

  async listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult> {
    const kind = repoKind(source);
    // HF list API 无页码：用 limit=page*pageSize 拉取后切片，实现分页
    const limit = Math.min(1000, params.page * params.pageSize);
    const url = new URL(`${BASE}/${kind}`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("sort", "downloads");
    url.searchParams.set("direction", "-1");
    if (params.query) url.searchParams.set("search", params.query);

    const res = await fetch(url.toString(), {
      headers: authHeaders(source),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    }
    const all = (await res.json()) as HfRepo[];
    const start = (params.page - 1) * params.pageSize;
    const slice = all.slice(start, start + params.pageSize);
    const items: CrawlerResourceItem[] = slice.map((r) => ({
      externalId: r.id,
      title: r.id,
      detailUrl: `https://huggingface.co/${kind}/${r.id}`,
      downloadUrl: `https://huggingface.co/${kind}/${r.id}`,
      updatedAt: r.lastModified,
      metadata: { downloads: r.downloads, likes: r.likes },
    }));
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: all.length >= limit ? params.page + 1 : params.page,
      // HF 按 limit=page*pageSize 拉取：只要拿满了 limit，就说明还有更多
      hasMore: all.length >= limit && slice.length > 0,
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const kind = repoKind(source);
    return {
      item: {
        externalId,
        title: externalId,
        detailUrl: `https://huggingface.co/${kind}/${externalId}`,
      },
    };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const kind = repoKind(source);
    // HF 仓库非单文件下载，指向仓库页（供后续按需取具体文件）
    return {
      downloadUrl: `https://huggingface.co/${kind}/${externalId}`,
      filename: `${externalId.replace(/\//g, "__")}.url`,
    };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
