import { NextResponse } from "next/server";
import { getMusicCenterLogs } from "@/app/lib/music-center/run-task";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  return NextResponse.json({ logs: getMusicCenterLogs(limit) });
}
