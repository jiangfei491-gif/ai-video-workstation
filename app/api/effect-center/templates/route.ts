import { NextResponse } from "next/server";
import {
  isDeepSeekAvailable,
  listEffectPresets,
  listTransitionCatalog,
} from "@/app/lib/effect-center/deepseek-agent";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    presets: listEffectPresets(),
    transitions: listTransitionCatalog(),
    clipEffects: [
      { id: "zoom", label: "缩放" },
      { id: "blur", label: "模糊" },
      { id: "flash", label: "闪白" },
      { id: "shake", label: "抖动" },
      { id: "motion", label: "镜头动画" },
      { id: "glow", label: "光晕" },
    ],
    deepseekAvailable: isDeepSeekAvailable(),
    features: [
      "转场",
      "镜头动画",
      "缩放",
      "Blur",
      "Flash",
      "Shake",
      "Motion",
      "Glow",
      "Timeline",
      "OpenCut Adapter",
    ],
  });
}
