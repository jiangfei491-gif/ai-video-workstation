import { NextResponse } from "next/server";

import { getDownloaderManager } from "@/app/lib/resource-center/phase2";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const progress = await getDownloaderManager().getProgress(id);
  if (!progress) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true, ...progress });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { action?: string };
  const manager = getDownloaderManager();
  try {
    const task =
      body.action === "pause"
        ? await manager.pause(id)
        : body.action === "resume"
          ? await manager.resume(id)
          : body.action === "cancel"
            ? await manager.cancel(id)
            : body.action === "retry"
              ? await manager.retry(id)
              : null;
    if (!task) return NextResponse.json({ error: "无效 action" }, { status: 400 });
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
