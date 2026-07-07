import { NextResponse } from "next/server";

import { getCrawlerScheduler, startSchedulerTick } from "@/app/lib/resource-center/phase2";

export const runtime = "nodejs";

export async function GET() {
  startSchedulerTick();
  const scheduler = getCrawlerScheduler();
  const [global, dashboard, schedules] = await Promise.all([
    scheduler.getGlobalConfig(),
    scheduler.getDashboard(),
    scheduler.listSchedules(),
  ]);
  return NextResponse.json({
    ok: true,
    config: global.config,
    paused: global.paused,
    dashboard,
    schedules,
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    config?: Record<string, unknown>;
    paused?: boolean;
  };
  const scheduler = getCrawlerScheduler();
  if (body.paused !== undefined) {
    await scheduler.setPaused(body.paused);
  }
  if (body.config) {
    await scheduler.updateGlobalConfig(body.config);
  }
  const global = await scheduler.getGlobalConfig();
  return NextResponse.json({ ok: true, config: global.config, paused: global.paused });
}
