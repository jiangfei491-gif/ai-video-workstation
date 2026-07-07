import { NextResponse } from "next/server";

import { getCrawlerManager } from "@/app/lib/resource-center/phase2";
import { getResourceCenterRepos } from "@/database/repositories/resource-center";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sourceId = url.searchParams.get("source_id") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const repos = getResourceCenterRepos();
  const list = await repos.crawlerTask.list(
    "00000000-0000-4000-a000-000000000002",
    { source_id: sourceId, status: status as never },
    { limit: 50 }
  );
  return NextResponse.json({ ok: true, tasks: list.items, total: list.total });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    source_id?: string;
    maxItems?: number;
    timeoutSec?: number;
    scanMode?: "new_only" | "full_rescan" | "incremental";
    failureRetries?: number;
  };
  if (!body.source_id) {
    return NextResponse.json({ error: "缺少 source_id" }, { status: 400 });
  }

  // 归一化抓取参数（maxItems=0 表示不限，转为 undefined）
  const options: {
    maxItems?: number;
    timeoutSec?: number;
    scanMode?: "new_only" | "full_rescan" | "incremental";
    failureRetries?: number;
  } = {};
  if (typeof body.maxItems === "number" && body.maxItems > 0) {
    options.maxItems = Math.floor(body.maxItems);
  }
  if (typeof body.timeoutSec === "number" && body.timeoutSec > 0) {
    options.timeoutSec = Math.floor(body.timeoutSec);
  }
  if (body.scanMode) options.scanMode = body.scanMode;
  if (typeof body.failureRetries === "number" && body.failureRetries >= 0) {
    options.failureRetries = Math.floor(body.failureRetries);
  }

  try {
    const task = await getCrawlerManager().start(
      body.source_id,
      undefined,
      Object.keys(options).length > 0 ? options : undefined
    );
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
