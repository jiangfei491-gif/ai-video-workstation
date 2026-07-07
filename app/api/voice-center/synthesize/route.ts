import { NextResponse } from "next/server";
import {
  runVoiceCenterBatch,
  runVoiceCenterTask,
  type VoiceDirectorTask,
} from "@/app/lib/voice-center";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 配音中心 — 执行导演下发的配音任务 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      task?: VoiceDirectorTask;
      tasks?: VoiceDirectorTask[];
    };

    if (body.tasks?.length) {
      const results = await runVoiceCenterBatch(body.tasks);
      return NextResponse.json({ results });
    }

    if (!body.task?.text?.trim()) {
      return NextResponse.json({ error: "缺少 task.text" }, { status: 400 });
    }

    const task: VoiceDirectorTask = {
      ...body.task,
      id: body.task.id ?? `voice-${Date.now()}`,
      text: body.task.text.trim(),
    };

    const result = await runVoiceCenterTask(task);
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
