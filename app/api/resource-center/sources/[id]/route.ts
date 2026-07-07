import { NextResponse } from "next/server";

import { getSourceManager } from "@/app/lib/resource-center/phase2";
import type { ResourceSourceInput } from "@/database/repositories/resource-center/interfaces";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const source = await getSourceManager().get(id);
  if (!source) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true, source });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const patch = (await req.json()) as Partial<ResourceSourceInput>;
  const source = await getSourceManager().update(id, patch);
  if (!source) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true, source });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await getSourceManager().remove(id);
  if (!ok) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
