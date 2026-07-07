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

const BASE = "https://civitai.com/api/v1";

/** 可选 API key：source.metadata.api_key 或环境变量 CIVITAI_API_KEY（公开模型无需 key） */
function readKey(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  const k = (meta.api_key as string) || process.env.CIVITAI_API_KEY;
  return k?.trim() || undefined;
}

function authHeaders(source: ResourceSourceRow): Record<string, string> {
  const key = readKey(source);
  return key ? { Authorization: `Bearer ${key}` } : {};
}

type CivitaiFile = { name?: string; downloadUrl?: string; sizeKB?: number };
type CivitaiVersion = { downloadUrl?: string; files?: CivitaiFile[] };
type CivitaiModel = {
  id: number;
  name?: string;
  type?: string;
  nsfw?: boolean;
  allowCommercialUse?: string[] | string;
  modelVersions?: CivitaiVersion[];
};

/** allowCommercialUse 含 None 之外的任一项即视为可商用 */
function commercialAllowed(m: CivitaiModel): boolean {
  const raw = m.allowCommercialUse;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.some((x) => x && x.toLowerCase() !== "none");
}

function mapModel(m: CivitaiModel): CrawlerResourceItem {
  const ver = m.modelVersions?.[0];
  const file = ver?.files?.[0];
  const commercial = commercialAllowed(m);
  return {
    externalId: String(m.id),
    title: m.name ?? `model-${m.id}`,
    detailUrl: `https://civitai.com/models/${m.id}`,
    downloadUrl: ver?.downloadUrl ?? file?.downloadUrl ?? "",
    metadata: {
      type: m.type,
      nsfw: m.nsfw,
      filename: file?.name,
      sizeKB: file?.sizeKB,
      allowCommercialUse: m.allowCommercialUse,
      license: commercial ? "Civitai · 可商用" : "Civitai · 禁商用",
      commercial: commercial ? "attribution" : "noncommercial",
    },
  };
}

/** Civitai — LoRA / Checkpoint 等模型库（公开内容无需 API key） */
export class CivitaiCrawlerProvider implements CrawlerProvider {
  readonly slug = "civitai";
  readonly label = "Civitai";

  /** Civitai 不认 page 参数，只支持 cursor 分页；按 sourceId 记住下一页 cursor */
  private cursors = new Map<string, string>();

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/models?limit=1`, {
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
    const url = new URL(`${BASE}/models`);
    url.searchParams.set("limit", String(Math.min(100, params.pageSize)));
    // cursor 分页：第 1 页从头开始，之后用上一页记住的 cursor
    if (params.page <= 1) {
      this.cursors.delete(source.id);
    } else {
      const cur = this.cursors.get(source.id);
      if (cur) url.searchParams.set("cursor", cur);
    }
    const types = source.resource_types ?? [];
    if (types.includes("character")) {
      // 角色库：LoRA + character 标签
      url.searchParams.set("types", "LORA");
      url.searchParams.set("tag", "character");
    } else if (types.includes("lora")) {
      url.searchParams.set("types", "LORA");
    }
    if (params.query) url.searchParams.set("query", params.query);

    const res = await fetch(url.toString(), {
      headers: authHeaders(source),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    }
    const data = (await res.json()) as { items?: CivitaiModel[]; metadata?: { nextCursor?: string } };
    // 只保留标注了可商用的模型
    const items = (data.items ?? []).filter(commercialAllowed).map(mapModel);
    const nextCursor = data.metadata?.nextCursor;
    if (nextCursor) this.cursors.set(source.id, nextCursor);
    else this.cursors.delete(source.id);
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: params.page + (nextCursor ? 1 : 0),
      hasMore: Boolean(nextCursor),
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const res = await fetch(`${BASE}/models/${externalId}`, {
      headers: authHeaders(source),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { item: { externalId, title: externalId, detailUrl: `https://civitai.com/models/${externalId}` } };
    const m = (await res.json()) as CivitaiModel;
    return { item: mapModel(m) };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    return {
      downloadUrl: item.downloadUrl || `https://civitai.com/api/download/models/${externalId}`,
      filename: (meta.filename as string) || `${externalId}.safetensors`,
      bytesTotal: typeof meta.sizeKB === "number" ? Math.round(meta.sizeKB * 1024) : undefined,
    };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
