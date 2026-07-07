import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/app/lib/intelligence-center/settings/store";
import type { IcSettings } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intelligence-center/settings */
export async function GET() {
  return NextResponse.json({ settings: getSettings() });
}

/** PUT /api/intelligence-center/settings  body: Partial<IcSettings> */
export async function PUT(req: Request) {
  let patch: Partial<IcSettings>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "非法 JSON" }, { status: 400 });
  }
  return NextResponse.json({ settings: updateSettings(patch) });
}
