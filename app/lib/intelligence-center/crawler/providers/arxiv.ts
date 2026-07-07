import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";
import { blocks, tag, tags } from "./_xml";

const ENDPOINT = "https://export.arxiv.org/api/query";

/** arXiv Provider —— 发现最新论文（Atom API，公开免 token） */
export class ArxivProvider implements IcProvider {
  readonly slug = "arxiv";
  readonly platformId = "arxiv" as const;
  readonly label = "arXiv";
  readonly connected = true;

  async testConnection() {
    try {
      const res = await fetch(`${ENDPOINT}?search_query=all:electron&max_results=1`, {
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const max = Math.min(50, params?.pageSize ?? 20);
    const start = ((params?.page ?? 1) - 1) * max;
    const q = (source.query?.q as string) || "video generation OR diffusion OR text-to-video";
    // 无布尔运算符的多词查询作短语检索，提升相关度
    const hasOp = /\b(AND|OR|NOT)\b/.test(q);
    const searchQuery = !hasOp && /\s/.test(q.trim()) ? `all:"${q.trim()}"` : `all:${q}`;
    const url = new URL(ENDPOINT);
    url.searchParams.set("search_query", searchQuery);
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");
    url.searchParams.set("start", String(start));
    url.searchParams.set("max_results", String(max));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`);
    const xml = await res.text();

    const items: IcDiscoveredItem[] = blocks(xml, "entry").map((e) => {
      const id = tag(e, "id");
      const title = tag(e, "title").replace(/\s+/g, " ");
      const summary = tag(e, "summary").replace(/\s+/g, " ");
      const published = tag(e, "published");
      const authors = tags(e, "name").slice(0, 6);
      return {
        id: `arxiv-${id.split("/abs/")[1] ?? id}`,
        platformId: "arxiv" as const,
        externalId: id,
        title,
        url: id,
        summary,
        metadata: { published, authors },
        discoveredAt: new Date().toISOString(),
      };
    });
    return { items, hasMore: items.length >= max };
  }
}
