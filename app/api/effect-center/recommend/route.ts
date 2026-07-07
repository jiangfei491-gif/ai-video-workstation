import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit";
import { runDeepSeekEffectPlan, recommendEffectPlanFallback } from "@/app/lib/effect-center/deepseek-agent";
import type { EffectDirectorTask, EffectPresetId } from "@/app/lib/effect-center/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench?: T2VWorkbenchState;
      optimizeWithAi?: boolean;
      preset?: EffectPresetId;
    };

    const graph = body.workbench?.editGraph;
    const input = body.workbench ? buildEditInputFromWorkbench(body.workbench) : null;
    if (!graph?.timeline.video.length) {
      return NextResponse.json({ error: "视频轨为空" }, { status: 400 });
    }

    const task: EffectDirectorTask = {
      id: `rec-${Date.now()}`,
      durationSec: graph.timeline.durationSec,
      pacingProfile: graph.pacingProfile,
      topic: input?.topic ?? body.workbench?.topic,
      script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
      optimizeWithAi: body.optimizeWithAi !== false,
      preset: body.preset,
      videoClips: graph.timeline.video.map((c) => ({
        id: c.id,
        label: c.label,
        startSec: c.startSec,
        durationSec: c.durationSec,
        shotIndex: c.video?.shotIndex,
      })),
      subtitleHints: graph.timeline.subtitle.map((c) => ({
        text: c.subtitle?.text ?? "",
        startSec: c.startSec,
        endSec: c.startSec + c.durationSec,
      })),
      voiceHints: graph.timeline.voice.map((c) => ({
        startSec: c.startSec,
        endSec: c.startSec + c.durationSec,
      })),
    };

    const { plan, cost } =
      task.optimizeWithAi !== false
        ? await runDeepSeekEffectPlan(task)
        : { plan: recommendEffectPlanFallback(task), cost: 0 };

    return NextResponse.json({ plan, cost });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
