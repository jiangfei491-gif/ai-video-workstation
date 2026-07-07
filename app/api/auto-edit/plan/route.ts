import { NextResponse } from "next/server";
import {
  buildEditInputFromWorkbench,
  buildDefaultEditSequence,
  applyNarrativeOrder,
  pacingFromStyle,
  syncClipAssetsFromWorkbench,
} from "@/app/lib/auto-edit";
import { generateEditPlan } from "@/app/lib/auto-edit/generate-edit-plan";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      useAi?: boolean;
    };
    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "请先运行编导生成分镜" }, { status: 400 });
    }

    const pacing = pacingFromStyle(body.workbench);
    let plan;
    if (body.useAi !== false) {
      plan = await generateEditPlan(input, pacing);
    } else {
      let seq = buildDefaultEditSequence(input, pacing);
      seq = applyNarrativeOrder(seq, input.narrativeEdges);
      plan = {
        ...seq,
        aiNotes: ["使用默认分镜顺序"],
        sectionPacing: {},
      };
    }

    const sequence = syncClipAssetsFromWorkbench(plan, input);
    return NextResponse.json({ plan, sequence });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
