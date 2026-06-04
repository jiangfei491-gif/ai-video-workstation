import { NextResponse } from "next/server";
import { buildModelCandidates, getOpenAIApiKey } from "@/app/lib/openai-key";
import { getUsageStats } from "@/app/lib/usage-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const defaultModel = buildModelCandidates()[0] ?? "gpt-4.1";
    const stats = await getUsageStats(defaultModel);

    return NextResponse.json({
      success: true,
      todayTokens: stats.todayTokens,
      monthTokens: stats.monthTokens,
      estimatedCost: stats.estimatedCost,
      model: stats.model || defaultModel,
      successRate: stats.successRate,
      todayRequests: stats.todayRequests,
      monthRequests: stats.monthRequests,
      apiConnected: Boolean(getOpenAIApiKey()),
    });
  } catch (err) {
    console.error("[api/openai/stats]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "读取统计失败",
      },
      { status: 500 }
    );
  }
}
