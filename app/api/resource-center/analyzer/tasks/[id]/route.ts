import { NextResponse } from "next/server";

import { getAnalyzerManager } from "@/app/lib/resource-center/phase3";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const data = await getAnalyzerManager().getTask(id);
  if (!data) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { action?: string };
  if (body.action === "retry") {
    const task = await getAnalyzerManager().runAnalysis(id);
    return NextResponse.json({ ok: true, task });
  }
  return NextResponse.json({ error: "未知 action" }, { status: 400 });
}
