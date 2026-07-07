import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

// 用 Hacker News（Algolia）作为 AI 资讯发现源：公开免 token，覆盖新工具/模型/讨论。
const ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date";

type HnHit = {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  author?: string;
  created_at?: string;
};

/** AI News Provider —— 发现 AI 相关资讯/讨论（Hacker News，公开免 token） */
export class AiNewsProvider implements IcProvider {
  readonly slug = "ai-news";
  readonly platformId = "ai-news" as const;
  readonly label = "AI News";
  readonly connected = true;

  async testConnection() {
    try {
      const res = await fetch(`${ENDPOINT}?query=AI&tags=story&hitsPerPage=1`, {
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("query", (source.query?.query as string) || "AI video generation");
    url.searchParams.set("tags", "story");
    url.searchParams.set("hitsPerPage", String(Math.min(50, params?.pageSize ?? 20)));
    url.searchParams.set("page", String((params?.page ?? 1) - 1));
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HN HTTP ${res.status}`);
    const data = (await res.json()) as { hits?: HnHit[]; nbPages?: number; page?: number };
    const items: IcDiscoveredItem[] = (data.hits ?? []).map((h) => ({
      id: `hn-${h.objectID}`,
      platformId: "ai-news",
      externalId: h.objectID,
      title: h.title || "(无标题)",
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      summary: h.author ? `by ${h.author}` : "",
      metadata: {
        points: h.points,
        comments: h.num_comments,
        createdAt: h.created_at,
        hn: `https://news.ycombinator.com/item?id=${h.objectID}`,
      },
      discoveredAt: new Date().toISOString(),
    }));
    return { items, hasMore: (data.page ?? 0) + 1 < (data.nbPages ?? 1) };
  }
}
