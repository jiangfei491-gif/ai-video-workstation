import { NextResponse } from "next/server";

import { getSourceManager } from "@/app/lib/resource-center/phase2";
import type { ResourceSourceInput, ResourceSourceQuery } from "@/database/repositories/resource-center/interfaces";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query: ResourceSourceQuery = {
    q: url.searchParams.get("q") ?? undefined,
    site_category: url.searchParams.get("category") ?? undefined,
    resource_type: url.searchParams.get("resource_type") ?? undefined,
    enabled: url.searchParams.has("enabled") ? url.searchParams.get("enabled") === "true" : undefined,
    sort: (url.searchParams.get("sort") as ResourceSourceQuery["sort"]) ?? "updated_at",
    order: (url.searchParams.get("order") as ResourceSourceQuery["order"]) ?? "desc",
  };
  const manager = getSourceManager();
  manager.ensureDownloadsLayout();
  const [list, stats] = await Promise.all([manager.list(undefined, query), manager.stats()]);
  return NextResponse.json({ ok: true, sources: list.items, total: list.total, stats });
}

export async function POST(req: Request) {
  const body = (await req.json()) as ResourceSourceInput;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "名称必填" }, { status: 400 });
  }
  const source = await getSourceManager().create(body);
  return NextResponse.json({ ok: true, source });
}
