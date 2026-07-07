import { NextResponse } from "next/server";
import { getSavedSource, removeSavedSource, updateSavedSource } from "@/app/lib/intelligence-center/sources/store";
import { runSource } from "@/app/lib/intelligence-center/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/intelligence-center/sources/[id]
 * body: { op: "run" } 立即运行；否则作为 patch 更新（enabled/intervalMinutes/query/autoScore/name）
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const src = getSavedSource(id);
  if (!src) return NextResponse.json({ error: "源不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.op === "run") {
    const result = await runSource(src);
    return NextResponse.json({ result, source: getSavedSource(id) });
  }

  const { op: _op, ...patch } = body;
  return NextResponse.json({ source: updateSavedSource(id, patch) });
}

/** DELETE —— 删除订阅源 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ removed: removeSavedSource(id) });
}
