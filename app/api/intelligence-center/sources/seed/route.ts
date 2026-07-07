import { NextResponse } from "next/server";
import { seedDefaultSources } from "@/app/lib/intelligence-center/sources/presets";
import type { IcPlatformId } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/intelligence-center/sources/seed  body: { platform?: IcPlatformId }
 * 一键铺满：为所有平台（或指定平台）播下推荐默认源（存量+盯新），按名称去重。
 */
export async function POST(req: Request) {
  let platform: IcPlatformId | undefined;
  try {
    platform = (await req.json())?.platform;
  } catch {
    platform = undefined;
  }
  const result = seedDefaultSources(platform);
  return NextResponse.json(result);
}
