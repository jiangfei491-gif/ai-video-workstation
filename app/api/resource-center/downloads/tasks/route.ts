import { NextResponse } from "next/server";

import { getDownloaderManager } from "@/app/lib/resource-center/phase2";
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { getResourceCenterRepos } from "@/database/repositories/resource-center";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const repos = getResourceCenterRepos();
  const list = await repos.downloadTask.list(
    DEFAULT_WORKSPACE_ID,
    { status: status as never },
    { limit: 50 }
  );
  return NextResponse.json({ ok: true, tasks: list.items, total: list.total });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    source_id?: string;
    remote_url?: string;
    filename?: string;
  };
  if (!body.remote_url?.trim()) {
    return NextResponse.json({ error: "缺少 remote_url" }, { status: 400 });
  }
  const task = await getDownloaderManager().enqueue({
    workspaceId: DEFAULT_WORKSPACE_ID,
    sourceId: body.source_id ?? "manual",
    remoteUrl: body.remote_url,
    filename: body.filename ?? "download.bin",
  });
  return NextResponse.json({ ok: true, task });
}
