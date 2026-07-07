import { NextResponse } from "next/server";
import { runSubtitleCenterTask, type SubtitleDirectorTask } from "@/app/lib/subtitle-center";

export const runtime = "nodejs";
export const maxDuration = 120;

/** 字幕中心 — 执行字幕任务 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { task?: SubtitleDirectorTask };
    if (!body.task?.id) {
      return NextResponse.json({ error: "缺少 task.id" }, { status: 400 });
    }
    const result = await runSubtitleCenterTask(body.task);
    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
