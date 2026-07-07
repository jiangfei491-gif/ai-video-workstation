import { NextResponse } from "next/server";
import {
  VOICE_CATEGORY_LABEL,
  searchVoiceLibrary,
  type VoiceCategory,
} from "@/app/lib/voice-center";

export const runtime = "nodejs";

/** 配音中心 — 音色库 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") as VoiceCategory | null;
  const voices = searchVoiceLibrary(q, category ?? undefined);
  return NextResponse.json({
    voices,
    categories: VOICE_CATEGORY_LABEL,
  });
}
