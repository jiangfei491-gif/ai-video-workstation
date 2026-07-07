import { NextResponse } from "next/server";

import { getCrawlerScheduler, startSchedulerTick } from "@/app/lib/resource-center/phase2";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const schedule = await getCrawlerScheduler().getSourceSchedule(id);
  return NextResponse.json({ ok: true, schedule });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const schedule = await getCrawlerScheduler().updateSourceSchedule(id, body);
  return NextResponse.json({ ok: true, schedule });
}

export async function POST(req: Request, ctx: Ctx) {
  startSchedulerTick();
  const { id } = await ctx.params;
  const body = (await req.json()) as { action?: string };
  const scheduler = getCrawlerScheduler();

  switch (body.action) {
    case "sync_now":
      return NextResponse.json({ ok: true, ...(await scheduler.syncNow(id)) });
    case "pause":
      await scheduler.updateSourceSchedule(id, { enabled: false });
      return NextResponse.json({ ok: true });
    case "resume":
      await scheduler.updateSourceSchedule(id, { enabled: true });
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "未知 action" }, { status: 400 });
  }
}
