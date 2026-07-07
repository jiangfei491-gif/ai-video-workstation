import { NextResponse } from "next/server";
import { getIcProviderForPlatform } from "@/app/lib/intelligence-center/crawler/registry";
import { IC_PLATFORM_BY_ID } from "@/app/lib/intelligence-center/platforms";
import { logEvent } from "@/app/lib/intelligence-center/event-log/store";
import { getSettings } from "@/app/lib/intelligence-center/settings/store";
import type { IcPlatformId, IcSource } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/intelligence-center/[platform]/discover
 * 通过统一 Crawler Framework 的 Provider 发现该平台的新项目。
 * 已接入：github / huggingface / modelscope；其余平台返回 connected:false。
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform } = await ctx.params;
  const platformId = platform as IcPlatformId;

  if (!IC_PLATFORM_BY_ID[platformId]) {
    return NextResponse.json({ error: `未知平台 ${platform}` }, { status: 404 });
  }

  const provider = getIcProviderForPlatform(platformId);
  if (!provider) {
    return NextResponse.json({ connected: false, items: [], note: "未注册 Provider" });
  }
  if (!provider.connected) {
    return NextResponse.json({
      connected: false,
      items: [],
      note: "架构就绪 · 待接入 API",
    });
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const pageSize =
    Number(url.searchParams.get("pageSize") ?? "") || getSettings().discoverPageSize;

  // 从 query 参数构造一个临时 Source（平台各自的查询字段）
  const query: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "page" || k === "pageSize") continue;
    query[k] = v;
  }

  const source: IcSource = {
    id: `adhoc-${platformId}`,
    platformId,
    name: `${platformId} 即时发现`,
    providerSlug: provider.slug,
    query,
    enabled: true,
    requiresToken: true,
    createdAt: new Date().toISOString(),
  };

  try {
    const { items, hasMore } = await provider.discover(source, { page, pageSize });
    logEvent({
      platformId,
      kind: "discover",
      level: "info",
      message: `发现 ${items.length} 项${query && Object.keys(query).length ? `（${Object.values(query).join(" ")}）` : ""}`,
      meta: { count: items.length, query },
    });
    return NextResponse.json({ connected: true, items, hasMore, page });
  } catch (e) {
    logEvent({ platformId, kind: "discover", level: "error", message: `发现失败：${(e as Error).message}` });
    return NextResponse.json(
      { connected: true, items: [], error: (e as Error).message },
      { status: 502 },
    );
  }
}
