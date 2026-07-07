import { NextResponse } from "next/server";
import { getVoiceCenterLogs } from "@/app/lib/voice-center";

export const runtime = "nodejs";

/** 配音中心 — 最近合成日志 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  return NextResponse.json({ logs: getVoiceCenterLogs(limit) });
}
