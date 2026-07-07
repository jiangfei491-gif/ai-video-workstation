import { NextResponse } from "next/server";
import { ensureMaterialScheduleRunner } from "@/app/lib/materials/schedule-runner";
import {
  deleteSchedule,
  getSchedule,
  updateSchedule,
} from "@/app/lib/materials/schedule-store";
import type { ScheduleFrequency } from "@/app/lib/materials/schedule-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type Body = {
  name?: string;
  enabled?: boolean;
  task?: string;
  count?: number;
  category?: string;
  language?: string;
  autoAnalyze?: boolean;
  frequency?: ScheduleFrequency;
  timeOfDay?: string;
  weekday?: number;
  intervalHours?: number;
};

export async function PATCH(req: Request, { params }: Params) {
  ensureMaterialScheduleRunner();
  const { id } = await params;
  if (!getSchedule(id)) {
    return NextResponse.json({ error: "定时任务不存在" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  try {
    const { language, ...rest } = body;
    const schedule = updateSchedule(id, {
      ...rest,
      ...(language !== undefined ? { language } : {}),
    });
    return NextResponse.json({ schedule });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!deleteSchedule(id)) {
    return NextResponse.json({ error: "定时任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
