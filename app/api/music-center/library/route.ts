import { NextResponse } from "next/server";
import { listBgmLibrary, listSfxLibrary } from "@/app/lib/music-center/bgm-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    bgm: listBgmLibrary(),
    sfx: listSfxLibrary(),
  });
}
