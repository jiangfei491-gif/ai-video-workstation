import { NextResponse } from "next/server";
import { getSubtitleCenterLogs } from "@/app/lib/subtitle-center";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  return NextResponse.json({ logs: getSubtitleCenterLogs(limit) });
}
