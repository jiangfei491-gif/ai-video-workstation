import { NextResponse } from "next/server";
import { listStyleTemplates, listAnimationPresets, listSubtitleLanguages } from "@/app/lib/subtitle-center";

export const runtime = "nodejs";

/** 字幕中心 — 风格 / 动画 / 语言目录 */
export async function GET() {
  return NextResponse.json({
    styles: listStyleTemplates(),
    animations: listAnimationPresets(),
    languages: listSubtitleLanguages(),
  });
}
