import { NextResponse } from "next/server";
import { getEffectCenterLogs } from "@/app/lib/effect-center/run-task";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  return NextResponse.json({ logs: getEffectCenterLogs(limit) });
}
