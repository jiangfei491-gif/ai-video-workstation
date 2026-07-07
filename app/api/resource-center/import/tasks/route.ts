import { NextResponse } from "next/server";

import { getLibraryIngestManager } from "@/app/lib/resource-center/phase3";
import { getResourceCenterPhase3Repos } from "@/database/repositories/resource-center";
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";

export const runtime = "nodejs";

export async function GET() {
  const repos = getResourceCenterPhase3Repos();
  const imports = await repos.importTask.list(DEFAULT_WORKSPACE_ID, undefined, { limit: 50 });
  const items = await repos.libraryItem.list(DEFAULT_WORKSPACE_ID, { limit: 50, sort: "recent" });
  return NextResponse.json({
    ok: true,
    importTasks: imports.items,
    libraryItems: items.items,
    totals: { imports: imports.total, items: items.total },
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { analysis_task_id?: string };
  if (!body.analysis_task_id) {
    return NextResponse.json({ error: "缺少 analysis_task_id" }, { status: 400 });
  }
  const task = await getLibraryIngestManager().enqueueFromAnalysis(body.analysis_task_id);
  return NextResponse.json({ ok: true, task });
}
