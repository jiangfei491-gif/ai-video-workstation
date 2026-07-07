import { NextResponse } from "next/server";
import { isDeepSeekAvailable, listMusicStyleTemplates } from "@/app/lib/music-center/deepseek-agent";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    styles: listMusicStyleTemplates(),
    deepseekAvailable: isDeepSeekAvailable(),
    features: [
      "BGM 管理",
      "音效建议",
      "音乐模板",
      "Ducking",
      "音量曲线",
      "自动卡点",
      "节奏分析",
      "时间轴生成",
      "OpenCut 适配",
    ],
  });
}
