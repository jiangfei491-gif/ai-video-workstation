import { NextResponse } from "next/server";

import { getCrawlerManager } from "@/app/lib/resource-center/phase2";
import { getResourceCenterRepos } from "@/database/repositories/resource-center";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const progress = await getCrawlerManager().getProgress(id);
  if (!progress) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true, ...progress });
}

async function action(id: string, op: "stop" | "pause" | "resume" | "retry") {
  const manager = getCrawlerManager();
  const task =
    op === "stop"
      ? await manager.stop(id)
      : op === "pause"
        ? await manager.pause(id)
        : op === "resume"
          ? await manager.resume(id)
          : await manager.retry(id);
  if (!task) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true, task });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { action?: string };
  const op = body.action as "stop" | "pause" | "resume" | "retry";
  if (!["stop", "pause", "resume", "retry"].includes(op)) {
    return NextResponse.json({ error: "无效 action" }, { status: 400 });
  }
  try {
    return await action(id, op);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    // 先停止运行中的任务，再从库中删除记录
    await getCrawlerManager().stop(id).catch(() => {});
    const ok = await getResourceCenterRepos().crawlerTask.delete(id);
    if (!ok) return NextResponse.json({ error: "未找到" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
