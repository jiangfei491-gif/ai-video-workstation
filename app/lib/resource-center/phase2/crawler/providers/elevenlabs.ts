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

const BASE = "https://api.elevenlabs.io/v1";

function readKey(source: ResourceSourceRow): string | undefined {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  return ((meta.api_key as string) || process.env.ELEVENLABS_API_KEY)?.trim() || undefined;
}

type ElevenVoice = {
  voice_id: string;
  name?: string;
  category?: string;
  accent?: string;
  gender?: string;
  language?: string;
  preview_url?: string;
  description?: string;
};

function mapVoice(v: ElevenVoice): CrawlerResourceItem {
  return {
    externalId: v.voice_id,
    title: v.name || v.voice_id,
    detailUrl: `https://elevenlabs.io/app/voice-library?voiceId=${v.voice_id}`,
    downloadUrl: v.preview_url ?? "",
    metadata: {
      category: v.category,
      accent: v.accent,
      gender: v.gender,
      language: v.language,
      description: v.description,
      license: "ElevenLabs（商用取决于你的套餐）",
      commercial: "attribution",
    },
  };
}

/**
 * ElevenLabs — TTS 音色库（用共享音色库 /v1/shared-voices）。
 * 注意：API key 需具备 voices_read 权限，否则返回 401。
 */
export class ElevenLabsCrawlerProvider implements CrawlerProvider {
  readonly slug = "elevenlabs";
  readonly label = "ElevenLabs";

  async testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult> {
    const key = readKey(source);
    if (!key) return { ok: false, message: "未配置 ElevenLabs API key（ELEVENLABS_API_KEY）" };
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/shared-voices?page_size=1`, {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 401) {
        return { ok: false, latencyMs: Date.now() - t0, statusCode: 401, message: "key 缺 voices_read 权限（去 elevenlabs.io 给 key 开启 Voices 读取）" };
      }
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
    const key = readKey(source);
    if (!key) throw new Error("未配置 ElevenLabs API key（ELEVENLABS_API_KEY）");
    const url = new URL(`${BASE}/shared-voices`);
    url.searchParams.set("page_size", String(Math.min(100, params.pageSize)));
    url.searchParams.set("page", String(params.page - 1)); // 0 基
    if (params.query) url.searchParams.set("search", params.query);

    const res = await fetch(url.toString(), {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 401) {
      throw new Error("ElevenLabs key 缺 voices_read 权限：请在 elevenlabs.io 给 API key 开启 Voices 读取权限");
    }
    if (!res.ok) return { items: [], page: params.page, pageSize: params.pageSize, totalPages: 0, hasMore: false };
    const data = (await res.json()) as { voices?: ElevenVoice[]; has_more?: boolean };
    const items = (data.voices ?? []).map(mapVoice).filter((i) => i.downloadUrl);
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: data.has_more ? params.page + 1 : params.page,
      hasMore: Boolean(data.has_more),
      updatedAt: new Date().toISOString(),
    };
  }

  async getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult> {
    const key = readKey(source);
    if (key) {
      const res = await fetch(`${BASE}/voices/${externalId}`, {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { item: mapVoice((await res.json()) as ElevenVoice) };
    }
    return { item: { externalId, title: externalId } };
  }

  async getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult> {
    const { item } = await this.getDetail(source, externalId);
    if (!item.downloadUrl) throw new Error("无音色试听链（检查 voices_read 权限）");
    return { downloadUrl: item.downloadUrl, filename: `${externalId}.mp3` };
  }

  async search(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult> {
    return this.listResources(source, { ...params, query });
  }
}
