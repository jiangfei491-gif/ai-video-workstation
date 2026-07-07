import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit";
import { recommendBgmByRules } from "@/app/lib/auto-edit/engines/music-engine/recommend";
import { bgmDirHint } from "@/app/lib/storage/workspace-paths";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState };
    const graph = body.workbench.editGraph;
    const input = buildEditInputFromWorkbench(body.workbench);

    const pacing =
      graph?.pacingProfile ??
      (body.workbench.projectBible?.videoType?.includes("短") ? "viral" : "documentary");

    const durationSec = graph?.timeline.durationSec ?? 60;
    const topic = input?.topic ?? body.workbench.topic;

    const rec = recommendBgmByRules({
      pacingProfile: pacing,
      durationSec,
      topic,
    });

    if (!rec) {
      return NextResponse.json(
        {
          error:
            `未找到 BGM 文件。请将 mp3/wav 放入 ${bgmDirHint()}/ 或先上传背景音乐`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ recommendation: rec });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
