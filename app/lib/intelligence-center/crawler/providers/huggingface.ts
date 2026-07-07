import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

const BASE = "https://huggingface.co/api";

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

/** HuggingFace Provider —— 发现新模型 */
export class HuggingFaceProvider implements IcProvider {
  readonly slug = "huggingface";
  readonly platformId = "huggingface" as const;
  readonly label = "HuggingFace";
  get connected(): boolean {
    return Boolean(token());
  }

  async testConnection() {
    try {
      const res = await fetch(`${BASE}/models?limit=1`, {
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const limit = Math.min(100, params?.pageSize ?? 20);
    const url = new URL(`${BASE}/models`);
    url.searchParams.set("search", (source.query?.search as string) || "video");
    url.searchParams.set("sort", (source.query?.sort as string) || "createdAt");
    url.searchParams.set("direction", "-1");
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString(), {
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HuggingFace HTTP ${res.status}`);
    const data = (await res.json()) as HfModel[];
    const items: IcDiscoveredItem[] = (data ?? []).map((m) => ({
      id: `hf-${m.id.replace(/\//g, "__")}`,
      platformId: "huggingface",
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
