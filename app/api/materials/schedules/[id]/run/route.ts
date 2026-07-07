import { NextResponse } from "next/server";
import {
  ensureMaterialScheduleRunner,
  isMaterialScheduleRunning,
  runMaterialScheduleNow,
} from "@/app/lib/materials/schedule-runner";
import { getSchedule } from "@/app/lib/materials/schedule-store";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  ensureMaterialScheduleRunner();
  const { id } = await params;

  if (!getOpenAIApiKey()) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }

  const schedule = getSchedule(id);
  if (!schedule) {
    return NextResponse.json({ error: "定时任务不存在" }, { status: 404 });
  }

  if (isMaterialScheduleRunning(id)) {
    return NextResponse.json({ error: "该任务正在运行中" }, { status: 409 });
  }

  await runMaterialScheduleNow(id);
  const updated = getSchedule(id);
  return NextResponse.json({ schedule: updated });
}
