import { NextResponse } from "next/server";
import {
  getModelPerformanceStats,
  getStylePerformanceStats,
} from "@/app/lib/materials/script-evolution/record-performance";
import { recommendEvolutionStrategy } from "@/app/lib/materials/script-evolution/recommend";
import { listScoreRecords } from "@/app/lib/materials/script-evolution/score-record-store";
import { listScriptRecords } from "@/app/lib/materials/script-evolution/script-record-store";
import { listAvailableProviders } from "@/app/lib/materials/script-evolution/providers";
import { getMaterial } from "@/app/lib/materials/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const materialId = url.searchParams.get("materialId")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const durationMinutes = Number(url.searchParams.get("durationMinutes"));

  const material = materialId ? getMaterial(materialId) : null;
  const recommendCategory = category || material?.category;
  const recommendDuration = Number.isFinite(durationMinutes) ? durationMinutes : 8;

  return NextResponse.json({
    providers: listAvailableProviders(),
    models: getModelPerformanceStats(),
    styles: getStylePerformanceStats(),
    recommendations: recommendEvolutionStrategy({
      category: recommendCategory,
      durationMinutes: recommendDuration,
    }),
    recentScripts: listScriptRecords({ materialId: materialId || undefined, limit: 20 }),
    recentScores: listScoreRecords({ materialId: materialId || undefined, limit: 30 }),
  });
}
