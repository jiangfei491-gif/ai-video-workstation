import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench, graphToSequence } from "@/app/lib/auto-edit";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import { runEffectCenterTask } from "@/app/lib/effect-center/run-task";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { EffectDirectorTask, EffectPresetId } from "@/app/lib/effect-center/types";
import type { TransitionType } from "@/app/lib/auto-edit/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 特效中心 — 为当前项目生成转场/镜头特效并写回 EditGraph */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      preset?: EffectPresetId;
      optimizeWithAi?: boolean;
      defaultTransition?: TransitionType;
      defaultTransitionMs?: number;
    };

    let graph = refreshEditGraphFromWorkbench(body.workbench);
    if (!graph?.timeline.video.length) {
      return NextResponse.json({ error: "请先生成视频时间线" }, { status: 400 });
    }

    const input = buildEditInputFromWorkbench(body.workbench);

    const task: EffectDirectorTask = {
      id: `project-${Date.now()}`,
      durationSec: graph.timeline.durationSec,
      pacingProfile: graph.pacingProfile,
      topic: input?.topic ?? body.workbench.topic,
      script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
      optimizeWithAi: body.optimizeWithAi !== false,
      preset: body.preset,
      defaultTransition: body.defaultTransition,
      defaultTransitionMs: body.defaultTransitionMs,
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

    const result = await runEffectCenterTask(task, graph.timeline.video);
    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }

    const nextGraph: EditGraph = {
      ...graph,
      timeline: {
        ...graph.timeline,
        video: result.video,
        transitions: result.transitions,
      },
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      editGraph: nextGraph,
      editSequence: graphToSequence(nextGraph),
      result,
      openCutCommands: result.openCut.commands,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
