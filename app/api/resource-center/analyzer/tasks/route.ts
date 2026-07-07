import { NextResponse } from "next/server";

import { getAnalyzerManager, isDeepSeekAvailable } from "@/app/lib/resource-center/phase3";

export const runtime = "nodejs";

export async function GET() {
  const manager = getAnalyzerManager();
  const tasks = await manager.listTasks();
  return NextResponse.json({
    ok: true,
    deepseekAvailable: isDeepSeekAvailable(),
    tasks: tasks.items,
    total: tasks.total,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { download_task_id?: string; analysis_task_id?: string };
  const manager = getAnalyzerManager();

  if (body.download_task_id) {
    const task = await manager.enqueueFromDownload(body.download_task_id);
    if (!task) {
      return NextResponse.json({ error: "无法创建分析任务" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, task });
  }

  if (body.analysis_task_id) {
    const task = await manager.runAnalysis(body.analysis_task_id);
    return NextResponse.json({ ok: true, task });
  }

  return NextResponse.json({ error: "缺少 download_task_id 或 analysis_task_id" }, { status: 400 });
}
