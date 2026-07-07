import { NextResponse } from "next/server";
import {
  ENGINE_MODULES,
  ENGINE_VERSION,
  phaseProgress,
  PROMPT_FORMULA,
} from "@/app/lib/consistency-engine";
import {
  getModelPerformanceStats,
  recommendModel,
  recommendTieredStrategy,
} from "@/app/lib/consistency-engine/performance/model-performance-store";
import { getProviderAvailability, getBflConfigHint } from "@/app/lib/image/providers/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const progress = phaseProgress();
  return NextResponse.json({
    version: ENGINE_VERSION,
    progress,
    modules: ENGINE_MODULES,
    formula: PROMPT_FORMULA,
    providers: getProviderAvailability(),
    bfl: getBflConfigHint(),
    tieredPipeline: {
      tiers: [
        "T1 FLUX Dev/Schnell 批量草稿",
        "T2 AI 十维评分筛选",
        "T3 GPT Image / Imagen 精修",
        "T4 Final QC + Auto Repair",
      ],
      qualityModes: ["fast", "standard", "advanced", "flagship"],
    },
    modelPerformance: getModelPerformanceStats(),
    recommendedModel: {
      documentary: recommendModel("documentary"),
      character: recommendModel("character"),
      cinematic: recommendModel("cinematic"),
      tiered: recommendTieredStrategy(),
    },
  });
}
