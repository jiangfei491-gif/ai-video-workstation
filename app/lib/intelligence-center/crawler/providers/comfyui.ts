import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

const ENDPOINT = "https://api.comfy.org/nodes";

type ComfyNode = {
  id: string;
  name?: string;
  description?: string;
  downloads?: number;
  github_stars?: number;
  author?: string;
  repository?: string;
  category?: string;
  latest_version?: { version?: string; createdAt?: string };
};

/** ComfyUI Provider —— 发现 ComfyUI 自定义节点（Comfy Registry，公开免 token） */
export class ComfyUiProvider implements IcProvider {
  readonly slug = "comfyui";
  readonly platformId = "comfyui" as const;
  readonly label = "ComfyUI";
  readonly connected = true;

  async testConnection() {
    try {
      const res = await fetch(`${ENDPOINT}?page=1&limit=1`, { signal: AbortSignal.timeout(10000) });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const limit = Math.min(50, params?.pageSize ?? 20);
    const url = new URL(ENDPOINT);
    url.searchParams.set("page", String(params?.page ?? 1));
    url.searchParams.set("limit", String(limit));
    const search = (source.query?.search as string) || "";
    if (search) url.searchParams.set("search", search);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Comfy HTTP ${res.status}`);
    const data = (await res.json()) as { nodes?: ComfyNode[]; totalPages?: number; page?: number };
    let nodes = data.nodes ?? [];
    // API 未必支持 search，兜底本地过滤
    if (search) {
      const q = search.toLowerCase();
      nodes = nodes.filter((n) => `${n.name} ${n.description} ${n.id}`.toLowerCase().includes(q));
    }
    const items: IcDiscoveredItem[] = nodes.map((n) => ({
      id: `comfy-${n.id}`,
      platformId: "comfyui",
      externalId: n.id,
      title: n.name || n.id,
      url: n.repository || `https://registry.comfy.org/nodes/${n.id}`,
      summary: n.description ?? "",
      metadata: {
        downloads: n.downloads,
        stars: n.github_stars,
        author: n.author,
        version: n.latest_version?.version,
        category: n.category,
      },
      discoveredAt: new Date().toISOString(),
    }));
    return { items, hasMore: (data.page ?? 1) < (data.totalPages ?? 1) };
  }
}
