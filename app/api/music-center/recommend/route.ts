import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit";
import { runDeepSeekMusicPlan, recommendMusicPlanFallback } from "@/app/lib/music-center/deepseek-agent";
import type { MusicDirectorTask } from "@/app/lib/music-center/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench?: T2VWorkbenchState;
      optimizeWithAi?: boolean;
      durationSec?: number;
      topic?: string;
    };

    const graph = body.workbench?.editGraph;
    const input = body.workbench ? buildEditInputFromWorkbench(body.workbench) : null;
    const durationSec = body.durationSec ?? graph?.timeline.durationSec ?? 60;

    const task: MusicDirectorTask = {
      id: `rec-${Date.now()}`,
      durationSec,
      pacingProfile: graph?.pacingProfile ?? "documentary",
      topic: body.topic ?? input?.topic ?? body.workbench?.topic,
      script: graph?.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
      optimizeWithAi: body.optimizeWithAi !== false,
      voiceClips: graph?.timeline.voice.map((c) => ({
        startSec: c.startSec,
        durationSec: c.durationSec,
      })),
      videoClips: graph?.timeline.video.map((c) => ({
        id: c.id,
        startSec: c.startSec,
        durationSec: c.durationSec,
      })),
    };

    const { plan, cost } =
      task.optimizeWithAi !== false
        ? await runDeepSeekMusicPlan(task)
        : { plan: recommendMusicPlanFallback(task), cost: 0 };

    return NextResponse.json({ plan, cost });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
