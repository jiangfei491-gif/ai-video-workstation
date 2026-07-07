import { NextResponse } from "next/server";
import { isDeepSeekAvailable } from "@/app/lib/qa-center/deepseek-agent";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    deepseekAvailable: isDeepSeekAvailable(),
    defaultThreshold: 75,
    ruleChecks: [
      "黑屏/空镜头",
      "镜长异常",
      "字幕过长",
      "字幕重叠",
      "时间轴空隙/重叠",
      "配音字幕不同步",
      "画幅分辨率",
    ],
    ffmpegChecks: ["视频/音频流", "分辨率", "blackdetect 黑屏"],
    features: ["Rule Engine", "FFmpeg", "OpenCV(blackdetect)", "Score", "Report", "Auto Retry"],
  });
}
