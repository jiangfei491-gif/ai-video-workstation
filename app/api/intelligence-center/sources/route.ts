import { NextResponse } from "next/server";
import { createSavedSource, listSavedSources, type CreateSourceInput } from "@/app/lib/intelligence-center/sources/store";
import { IC_PLATFORM_BY_ID } from "@/app/lib/intelligence-center/platforms";
import type { IcPlatformId } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intelligence-center/sources?platform= */
export async function GET(req: Request) {
  const platform = new URL(req.url).searchParams.get("platform") as IcPlatformId | null;
  return NextResponse.json({ sources: listSavedSources(platform ?? undefined) });
}

/** POST —— 新建订阅源 body: CreateSourceInput */
export async function POST(req: Request) {
  let body: CreateSourceInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "非法 JSON" }, { status: 400 });
  }
  if (!body.platformId || !IC_PLATFORM_BY_ID[body.platformId]) {
    return NextResponse.json({ error: "platformId 无效" }, { status: 400 });
  }
  return NextResponse.json({ source: createSavedSource(body) });
}
