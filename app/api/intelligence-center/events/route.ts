import { NextResponse } from "next/server";
import { listEvents, type IcEventKind, type IcEventLevel } from "@/app/lib/intelligence-center/event-log/store";
import type { IcPlatformId } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intelligence-center/events?platform=&kind=&level=&limit= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as IcPlatformId | null;
  const kind = url.searchParams.get("kind") as IcEventKind | null;
  const level = url.searchParams.get("level") as IcEventLevel | null;
  const limit = Number(url.searchParams.get("limit") ?? "200") || 200;
  return NextResponse.json({
    events: listEvents({
      platformId: platform ?? undefined,
      kind: kind ?? undefined,
      level: level ?? undefined,
      limit,
    }),
  });
}
