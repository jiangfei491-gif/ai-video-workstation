import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench, graphToSequence } from "@/app/lib/auto-edit";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import {
  applySpokenNarrationsToStoryboard,
  generateSpokenNarrationWithAi,
} from "@/app/lib/auto-edit/generate-spoken-narration";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState };
    const director = body.workbench.director;
    if (!director?.storyboard?.length) {
      return NextResponse.json({ error: "请先运行编导生成分镜" }, { status: 400 });
    }

    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "无法读取工作台数据" }, { status: 400 });
    }

    const narrations = await generateSpokenNarrationWithAi(input);
    const storyboard = applySpokenNarrationsToStoryboard(
      director.storyboard,
      narrations
    );

    const nextWorkbench: T2VWorkbenchState = {
      ...body.workbench,
      director: { ...director, storyboard },
    };

    const editGraph = refreshEditGraphFromWorkbench(nextWorkbench);

    return NextResponse.json({
      storyboard,
      editGraph,
      editSequence: editGraph ? graphToSequence(editGraph) : null,
      shotCount: narrations.size,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
