import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

const ENDPOINT = "https://registry.npmjs.org/-/v1/search";

type NpmObject = {
  package: {
    name: string;
    description?: string;
    date?: string;
    publisher?: { username?: string };
    links?: { npm?: string; repository?: string; homepage?: string };
  };
  score?: { final?: number; detail?: { popularity?: number } };
};

/** npm Provider —— 发现 AI 相关 npm 包（registry search，公开免 token） */
export class NpmProvider implements IcProvider {
  readonly slug = "npm";
  readonly platformId = "npm" as const;
  readonly label = "npm";
  readonly connected = true;

  async testConnection() {
    try {
      const res = await fetch(`${ENDPOINT}?text=ai&size=1`, { signal: AbortSignal.timeout(10000) });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const size = Math.min(50, params?.pageSize ?? 20);
    const from = ((params?.page ?? 1) - 1) * size;
    const url = new URL(ENDPOINT);
    url.searchParams.set("text", (source.query?.text as string) || "ai video generation");
    url.searchParams.set("size", String(size));
    url.searchParams.set("from", String(from));
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`npm HTTP ${res.status}`);
    const data = (await res.json()) as { objects?: NpmObject[]; total?: number };
    const items: IcDiscoveredItem[] = (data.objects ?? []).map((o) => ({
      id: `npm-${o.package.name}`,
      platformId: "npm",
      externalId: o.package.name,
      title: o.package.name,
      url: o.package.links?.npm ?? `https://www.npmjs.com/package/${o.package.name}`,
      summary: o.package.description ?? "",
      metadata: {
        updatedAt: o.package.date,
        publisher: o.package.publisher?.username,
        repository: o.package.links?.repository,
        score: o.score?.final,
      },
      discoveredAt: new Date().toISOString(),
    }));
    return { items, hasMore: from + items.length < (data.total ?? 0) };
  }
}
