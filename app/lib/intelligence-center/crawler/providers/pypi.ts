import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";
import { blocks, tag } from "./_xml";

// PyPI 已下线公开搜索 API；用「最近更新」RSS 作为发现源，关键词在本地过滤。
const RSS = "https://pypi.org/rss/updates.xml";

/** PyPI Provider —— 发现最近更新的 Python 包（RSS，公开免 token） */
export class PypiProvider implements IcProvider {
  readonly slug = "pypi";
  readonly platformId = "pypi" as const;
  readonly label = "PyPI";
  readonly connected = true;

  async testConnection() {
    try {
      const res = await fetch(RSS, { signal: AbortSignal.timeout(10000) });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { pageSize?: number }) {
    const res = await fetch(RSS, {
      headers: { "User-Agent": "AIVideoWorkstation-IntelligenceCenter" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`PyPI HTTP ${res.status}`);
    const xml = await res.text();
    const q = ((source.query?.q as string) || "").trim().toLowerCase();
    const limit = Math.min(100, params?.pageSize ?? 20);

    const items: IcDiscoveredItem[] = [];
    for (const b of blocks(xml, "item")) {
      const title = tag(b, "title"); // 形如 "pkgname 1.2.3"
      const link = tag(b, "link");
      const desc = tag(b, "description");
      const pubDate = tag(b, "pubDate");
      if (q && !`${title} ${desc}`.toLowerCase().includes(q)) continue;
      const name = title.split(/\s+/)[0] || title;
      items.push({
        id: `pypi-${title.replace(/\s+/g, "-")}`,
        platformId: "pypi",
        externalId: name,
        title,
        url: link || `https://pypi.org/project/${name}/`,
        summary: desc,
        metadata: { updatedAt: pubDate },
        discoveredAt: new Date().toISOString(),
      });
      if (items.length >= limit) break;
    }
    return { items, hasMore: false };
  }
}
