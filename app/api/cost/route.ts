import { NextResponse } from "next/server";
import { listCost, summarizeCost } from "@/app/lib/cost-ledger/unified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cost —— 全平台成本汇总 + 最近明细 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const module = url.searchParams.get("module") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "200") || 200;
  return NextResponse.json({
    summary: summarizeCost(),
    entries: listCost({ module, limit }),
  });
}
