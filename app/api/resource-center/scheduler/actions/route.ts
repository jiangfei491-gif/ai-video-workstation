import { NextResponse } from "next/server";

import { getCrawlerScheduler, startSchedulerTick } from "@/app/lib/resource-center/phase2";

export const runtime = "nodejs";

export async function POST(req: Request) {
  startSchedulerTick();
  const body = (await req.json()) as { action?: string; source_id?: string };
  const scheduler = getCrawlerScheduler();

  switch (body.action) {
    case "pause":
      await scheduler.setPaused(true);
      return NextResponse.json({ ok: true, paused: true });
    case "resume":
      await scheduler.setPaused(false);
      return NextResponse.json({ ok: true, paused: false });
    case "tick":
      await scheduler.tick();
      return NextResponse.json({ ok: true });
    case "sync_now":
      if (!body.source_id) {
        return NextResponse.json({ error: "缺少 source_id" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ...(await scheduler.syncNow(body.source_id)) });
    default:
      return NextResponse.json({ error: "未知 action" }, { status: 400 });
  }
}

export async function GET() {
  startSchedulerTick();
  const dashboard = await getCrawlerScheduler().getDashboard();
  return NextResponse.json({ ok: true, dashboard });
}
