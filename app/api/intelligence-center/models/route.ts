import { NextResponse } from "next/server";
import { listIcModels } from "@/app/lib/intelligence-center/analyzer/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intelligence-center/models —— 可用打分模型 + 成本（供 UI 选择） */
export async function GET() {
  return NextResponse.json({ models: listIcModels() });
}
