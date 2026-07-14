import { NextResponse } from "next/server";
import { latestSyncRun } from "@/app/lib/music-module/repository";
import { getSeedProgress } from "@/app/lib/music-module/seed-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET —— 最近入库记录 + 队列进度 */
export async function GET() {
  const [run, queue] = await Promise.all([latestSyncRun(), getSeedProgress()]);
  return NextResponse.json({ run, queue });
}
