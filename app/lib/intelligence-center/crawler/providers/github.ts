import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

const BASE = "https://api.github.com";

function token(): string | undefined {
  return process.env.GITHUB_TOKEN?.trim() || undefined;
}

type GhRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  topics?: string[];
};

/** GitHub Provider —— 发现 AI 相关开源仓库 */
export class GithubProvider implements IcProvider {
  readonly slug = "github";
  readonly platformId = "github" as const;
  readonly label = "GitHub";
  get connected(): boolean {
    return Boolean(token());
  }

  async testConnection() {
    const t = token();
    if (!t) return { ok: false, message: "未配置 GITHUB_TOKEN" };
    try {
      const res = await fetch(`${BASE}/rate_limit`, {
        headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, message: res.ok ? "连接成功" : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const t = token();
    if (!t) throw new Error("未配置 GITHUB_TOKEN");
    let q = (source.query?.q as string) || "text-to-video OR video-generation OR ai-video stars:>200";
    // 自动滚动的「最近 N 天新建」窗口：每次按当前日期重算，保证新建仓库不漏
    const days = Number(source.query?.days);
    if (Number.isFinite(days) && days > 0 && !/created:/.test(q)) {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      q = `${q} created:>${since}`;
    }
    const perPage = Math.min(50, params?.pageSize ?? 20);
    const page = params?.page ?? 1;
    const url = new URL(`${BASE}/search/repositories`);
    url.searchParams.set("q", q);
    url.searchParams.set("sort", (source.query?.sort as string) || "updated");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    const data = (await res.json()) as { total_count?: number; items?: GhRepo[] };
    const items: IcDiscoveredItem[] = (data.items ?? []).map((r) => ({
      id: `github-${r.id}`,
      platformId: "github",
      externalId: r.full_name,
      title: r.full_name,
      url: r.html_url,
      summary: r.description ?? "",
      metadata: {
        stars: r.stargazers_count,
        language: r.language,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        topics: r.topics ?? [],
      },
      discoveredAt: new Date().toISOString(),
    }));
    return { items, hasMore: (data.total_count ?? 0) > page * perPage };
  }
}
