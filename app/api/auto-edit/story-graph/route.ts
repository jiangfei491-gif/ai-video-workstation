import { NextResponse } from "next/server";
import {
  buildStoryGraphFromWorkbench,
  checkContinuity,
  suggestBeatSync,
  suggestFillShots,
} from "@/app/lib/auto-edit/engines/story-graph";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

/** Story Graph API：构建图 + 连续性 + 补镜建议 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState; bpm?: number };
    const graph = buildStoryGraphFromWorkbench(body.workbench);
    const issues = checkContinuity(body.workbench);
    const fillShots = suggestFillShots(body.workbench);
    const bpm = body.bpm ?? 120;
    const clips = body.workbench.editGraph?.timeline.video ?? [];
    const beatSync = suggestBeatSync(
      bpm,
      clips.map((c) => ({ clipId: c.id, startSec: c.startSec }))
    );

    return NextResponse.json({ graph, issues, fillShots, beatSync });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
