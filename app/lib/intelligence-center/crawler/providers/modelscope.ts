import type { IcDiscoveredItem, IcSource } from "../../types";
import type { IcProvider } from "../provider";

const ENDPOINT = "https://modelscope.cn/api/v1/dolphin/models";

function token(): string | undefined {
  return process.env.MODELSCOPE_TOKEN?.trim() || undefined;
}

type MsModel = {
  Name?: string;
  Path?: string;
  ChineseName?: string;
  Tasks?: { Name?: string }[] | string[];
  Downloads?: number;
  Stars?: number;
  CreatedTime?: number;
};

/** ModelScope Provider —— 发现魔搭新模型（PUT dolphin/models 检索） */
export class ModelScopeProvider implements IcProvider {
  readonly slug = "modelscope";
  readonly platformId = "modelscope" as const;
  readonly label = "ModelScope";
  get connected(): boolean {
    return Boolean(token());
  }

  private headers() {
    const t = token();
    return {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
  }

  async testConnection() {
    if (!token()) return { ok: false, message: "未配置 MODELSCOPE_TOKEN" };
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ PageSize: 1, PageNumber: 1, SortBy: "Default" }),
        signal: AbortSignal.timeout(10000),
      });
      const d = (await res.json().catch(() => ({}))) as { Code?: number };
      return { ok: d.Code === 200, message: d.Code === 200 ? "连接成功" : `Code ${d.Code}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async discover(source: IcSource, params?: { page?: number; pageSize?: number }) {
    const res = await fetch(ENDPOINT, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        PageSize: Math.min(50, params?.pageSize ?? 20),
        PageNumber: params?.page ?? 1,
        Name: (source.query?.name as string) || "",
        SortBy: (source.query?.sort as string) || "Default",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`ModelScope HTTP ${res.status}`);
    const data = (await res.json()) as {
      Code?: number;
      Data?: { Model?: { Models?: MsModel[] }; Models?: MsModel[]; TotalCount?: number };
    };
    const models = data.Data?.Model?.Models ?? data.Data?.Models ?? [];
    const items: IcDiscoveredItem[] = models.map((m) => {
      const fullPath = m.Path && m.Name ? `${m.Path}/${m.Name}` : m.Name || "";
      const tasks = Array.isArray(m.Tasks)
        ? m.Tasks.map((t) => (typeof t === "string" ? t : t?.Name)).filter(Boolean)
        : [];
      return {
        id: `modelscope-${fullPath.replace(/\//g, "__")}`,
        platformId: "modelscope",
        externalId: fullPath,
        title: m.ChineseName || m.Name || fullPath,
        url: fullPath ? `https://modelscope.cn/models/${fullPath}` : undefined,
        summary: tasks.join("、"),
        metadata: { downloads: m.Downloads, stars: m.Stars, tasks, createdTime: m.CreatedTime },
        discoveredAt: new Date().toISOString(),
      };
    });
    return { items, hasMore: models.length >= (params?.pageSize ?? 20) };
  }
}
