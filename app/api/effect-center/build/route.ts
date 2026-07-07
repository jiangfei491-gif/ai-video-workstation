import { NextResponse } from "next/server";
import { runEffectCenterTask } from "@/app/lib/effect-center/run-task";
import type { EffectDirectorTask } from "@/app/lib/effect-center/types";
import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EffectDirectorTask & {
      existingVideo?: TimelineClip[];
    };
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });
    }
    if (!body.videoClips?.length) {
      return NextResponse.json({ error: "缺少 videoClips" }, { status: 400 });
    }

    const existingVideo = body.existingVideo ?? [];
    const result = await runEffectCenterTask(body, existingVideo);
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
