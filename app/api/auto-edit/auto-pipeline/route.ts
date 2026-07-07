import { NextResponse } from "next/server";
import { runAutoEditPipeline } from "@/app/lib/auto-edit/run-auto-edit-pipeline";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState };
    const result = await runAutoEditPipeline(body.workbench);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
