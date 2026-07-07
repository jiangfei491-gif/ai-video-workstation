import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

const ENDPOINT = "https://registry.modelcontextprotocol.io/v0/servers";

type McpEntry = {
  server?: {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    repository?: { url?: string };
    remotes?: { type?: string; url?: string }[];
  };
  _meta?: { "io.modelcontextprotocol.registry/official"?: { publishedAt?: string; updatedAt?: string } };
};

/** MCP Provider —— 发现 MCP Server（官方 Registry，公开免 token） */
export class McpProvider implements IcProvider {
  readonly slug = "mcp";
  readonly platformId = "mcp" as const;
  readonly label = "MCP Registry";
  readonly connected = true;

  async testConnection() {
    try {
      const res = await fetch(`${ENDPOINT}?limit=1`, { signal: AbortSignal.timeout(10000) });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { pageSize?: number }) {
    const limit = Math.min(50, params?.pageSize ?? 20);
    const url = new URL(ENDPOINT);
    url.searchParams.set("limit", String(limit));
    const search = ((source.query?.search as string) || "").toLowerCase();
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
    const data = (await res.json()) as { servers?: McpEntry[]; metadata?: { nextCursor?: string } };
    let entries = data.servers ?? [];
    if (search) {
      entries = entries.filter((e) =>
        `${e.server?.name} ${e.server?.title} ${e.server?.description}`.toLowerCase().includes(search),
      );
    }
    const items: IcDiscoveredItem[] = entries.map((e) => {
      const s = e.server ?? {};
      const url2 = s.repository?.url || s.remotes?.[0]?.url;
      return {
        id: `mcp-${(s.name ?? "").replace(/[^\w.-]/g, "_")}`,
        platformId: "mcp" as const,
        externalId: s.name ?? "",
        title: s.title || s.name || "(未命名)",
        url: url2,
        summary: s.description ?? "",
        metadata: {
          name: s.name,
          version: s.version,
          publishedAt: e._meta?.["io.modelcontextprotocol.registry/official"]?.publishedAt,
        },
        discoveredAt: new Date().toISOString(),
      };
    });
    return { items, hasMore: Boolean(data.metadata?.nextCursor) };
  }
}
