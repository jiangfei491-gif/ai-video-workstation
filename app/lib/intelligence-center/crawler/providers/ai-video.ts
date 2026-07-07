import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

// AI 视频专项：HuggingFace 上 text-to-video / image-to-video 等视频生成模型（公开，token 可选）
const BASE = "https://huggingface.co/api/models";

function token(): string | undefined {
  return (process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN)?.trim() || undefined;
}

type HfModel = {
  id: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  createdAt?: string;
  tags?: string[];
};

/** AI Video Provider —— 发现视频生成模型（HuggingFace pipeline 过滤，token 可选） */
export class AiVideoProvider implements IcProvider {
  readonly slug = "ai-video";
  readonly platformId = "ai-video" as const;
  readonly label = "AI Video";
  readonly connected = true; // 公开 API，可匿名访问

  async testConnection() {
    try {
      const res = await fetch(`${BASE}?pipeline_tag=text-to-video&limit=1`, {
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { pageSize?: number }) {
    const limit = Math.min(100, params?.pageSize ?? 20);
    const url = new URL(BASE);
    url.searchParams.set("pipeline_tag", (source.query?.pipeline as string) || "text-to-video");
    url.searchParams.set("sort", "createdAt");
    url.searchParams.set("direction", "-1");
    url.searchParams.set("limit", String(limit));
    const search = (source.query?.search as string) || "";
    if (search) url.searchParams.set("search", search);
    const res = await fetch(url.toString(), {
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HF HTTP ${res.status}`);
    const data = (await res.json()) as HfModel[];
    const items: IcDiscoveredItem[] = (data ?? []).map((m) => ({
      id: `aiv-${m.id.replace(/\//g, "__")}`,
      platformId: "ai-video",
      externalId: m.id,
      title: m.id,
      url: `https://huggingface.co/${m.id}`,
      summary: m.pipeline_tag ?? "",
      metadata: {
        downloads: m.downloads,
        likes: m.likes,
        pipeline_tag: m.pipeline_tag,
        createdAt: m.createdAt,
        tags: m.tags ?? [],
      },
      discoveredAt: new Date().toISOString(),
    }));
    return { items, hasMore: items.length >= limit };
  }
}
