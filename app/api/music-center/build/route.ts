import { NextResponse } from "next/server";
import { runMusicCenterTask } from "@/app/lib/music-center/run-task";
import type { MusicDirectorTask } from "@/app/lib/music-center/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MusicDirectorTask;
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });
    }
    if (!body.durationSec || body.durationSec <= 0) {
      return NextResponse.json({ error: "缺少有效 durationSec" }, { status: 400 });
    }

    const result = await runMusicCenterTask(body);
    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
