import { NextResponse } from "next/server";

import { getAIResourceService } from "@/app/lib/resource-center/phase3";
import type { LibraryId } from "@/app/lib/resource-center/types";

export const runtime = "nodejs";

function callerFromRequest(req: Request) {
  return {
    moduleId: req.headers.get("x-ai-module-id") ?? "unknown",
    moduleLabel: req.headers.get("x-ai-module-label") ?? undefined,
  };
}

/** AI Resource Service — 唯一资源调用 HTTP 入口 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const service = getAIResourceService();
  const caller = callerFromRequest(req);

  const action = url.searchParams.get("action") ?? "search";
  const libraryId = url.searchParams.get("libraryId") ?? undefined;
  const itemId = url.searchParams.get("itemId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 20);

  if (action === "libraries") {
    return NextResponse.json({ ok: true, libraries: service.supportedLibraries() });
  }

  if (action === "get" && itemId && libraryId) {
    const item = await service.getById(libraryId as LibraryId, itemId, caller);
    if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  }

  if (action === "best" && libraryId) {
    const item = await service.recommendBest(libraryId as LibraryId, caller);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "similar" && itemId) {
    const result = await service.recommendSimilar(itemId, caller);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "recent") {
    const result = await service.getRecent(libraryId, limit, caller);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "popular") {
    const result = await service.getPopular(libraryId, limit, caller);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "random") {
    const result = await service.randomRecommend(libraryId, limit, caller);
    return NextResponse.json({ ok: true, ...result });
  }

  const query = {
    libraryId,
    category: url.searchParams.get("category") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    keyword: url.searchParams.get("keyword") ?? undefined,
    style: url.searchParams.get("style") ?? undefined,
    mood: url.searchParams.get("mood") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
    platform: url.searchParams.get("platform") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    minRating: url.searchParams.get("minRating") ? Number(url.searchParams.get("minRating")) : undefined,
    minQuality: url.searchParams.get("minQuality") ? Number(url.searchParams.get("minQuality")) : undefined,
    sort: (url.searchParams.get("sort") as "recent" | "rating" | "quality" | "popular" | "random") ?? "recent",
    limit,
    offset: Number(url.searchParams.get("offset") ?? 0),
  };

  const result = await service.search(query, caller);
  return NextResponse.json({ ok: true, ...result, service: "AI Resource Service" });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action?: string;
    libraryId?: string;
    itemId?: string;
    query?: Record<string, unknown>;
    moduleId?: string;
    moduleLabel?: string;
  };

  const service = getAIResourceService();
  const caller = {
    moduleId: body.moduleId ?? "unknown",
    moduleLabel: body.moduleLabel,
  };

  switch (body.action) {
    case "search":
      return NextResponse.json({
        ok: true,
        ...(await service.search(body.query ?? {}, caller)),
      });
    case "get":
      if (!body.libraryId || !body.itemId) {
        return NextResponse.json({ error: "缺少 libraryId / itemId" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        item: await service.getById(body.libraryId as LibraryId, body.itemId, caller),
      });
    case "best":
      return NextResponse.json({
        ok: true,
        item: await service.recommendBest(body.libraryId!, caller),
      });
    case "similar":
      return NextResponse.json({
        ok: true,
        ...(await service.recommendSimilar(body.itemId!, caller)),
      });
    default:
      return NextResponse.json({ error: "未知 action" }, { status: 400 });
  }
}
