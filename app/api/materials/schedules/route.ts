import { NextResponse } from "next/server";
import { ensureMaterialScheduleRunner } from "@/app/lib/materials/schedule-runner";
import {
  createSchedule,
  listSchedules,
} from "@/app/lib/materials/schedule-store";
import type { ScheduleFrequency } from "@/app/lib/materials/schedule-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  task?: string;
  count?: number;
  category?: string;
  language?: string;
  searchProvider?: string;
  autoAnalyze?: boolean;
  frequency?: ScheduleFrequency;
  timeOfDay?: string;
  weekday?: number;
  intervalHours?: number;
  enabled?: boolean;
};

export async function GET() {
  ensureMaterialScheduleRunner();
  return NextResponse.json({ schedules: listSchedules() });
}

export async function POST(req: Request) {
  ensureMaterialScheduleRunner();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (!body.task?.trim()) {
    return NextResponse.json({ error: "请填写任务描述" }, { status: 400 });
  }

  try {
    const schedule = createSchedule({
      name: body.name,
      task: body.task,
      count: body.count,
      category: body.category,
      language: body.language,
      searchProvider: body.searchProvider,
      autoAnalyze: body.autoAnalyze,
      frequency: body.frequency,
      timeOfDay: body.timeOfDay,
      weekday: body.weekday,
      intervalHours: body.intervalHours,
      enabled: body.enabled,
    });
    return NextResponse.json({ schedule });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 400 }
    );
  }
}
