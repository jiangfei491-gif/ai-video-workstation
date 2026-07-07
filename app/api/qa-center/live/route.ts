import { NextResponse } from "next/server";
import { getQaLiveLogs } from "@/app/lib/qa-center/live-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 获取质检自检实时日志（内存 ring buffer） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId")?.trim() || undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 80)));

  return NextResponse.json({
    logs: getQaLiveLogs({ taskId, limit }),
  });
}
