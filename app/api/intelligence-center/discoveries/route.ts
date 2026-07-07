import { NextResponse } from "next/server";
import { listDiscoveries } from "@/app/lib/intelligence-center/discoveries/store";
import type { IcPlatformId } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intelligence-center/discoveries?platform=&limit= —— 自动抓取留档 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as IcPlatformId | null;
  const limit = Number(url.searchParams.get("limit") ?? "100") || 100;
  return NextResponse.json({ discoveries: listDiscoveries(platform ?? undefined, limit) });
}
