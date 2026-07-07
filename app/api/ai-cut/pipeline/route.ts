import { NextResponse } from "next/server";
import { runAiCutPipeline } from "@/app/lib/ai-cut/run-pipeline";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** AI Cut 新编排：Director Plan → Clip Agent → OpenCut 命令 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState };
    const result = await runAiCutPipeline(body.workbench);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
