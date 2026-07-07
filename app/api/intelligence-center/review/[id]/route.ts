import { NextResponse } from "next/server";
import {
  approveRecord,
  installRecord,
  rejectRecord,
} from "@/app/lib/intelligence-center/review-queue/queue";
import { getRecord, removeRecord } from "@/app/lib/intelligence-center/review-queue/store";
import { logEvent } from "@/app/lib/intelligence-center/event-log/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/intelligence-center/review/[id]  body: { op: "approve"|"reject"|"install" }
 * install 只在 approve 后允许，且只做 git clone（不执行任何代码）。
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let op: string;
  try {
    op = (await req.json()).op;
  } catch {
    return NextResponse.json({ error: "非法 JSON" }, { status: 400 });
  }
  const rec0 = getRecord(id);
  if (!rec0) return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  switch (op) {
    case "approve": {
      logEvent({ platformId: rec0.platformId, kind: "approve", level: "info", message: `通过：${rec0.item.title}` });
      return NextResponse.json({ record: approveRecord(id) });
    }
    case "reject": {
      logEvent({ platformId: rec0.platformId, kind: "reject", level: "info", message: `拒绝：${rec0.item.title}` });
      return NextResponse.json({ record: rejectRecord(id) });
    }
    case "install": {
      const rec = await installRecord(id);
      const ok = rec?.install?.status === "installed";
      logEvent({
        platformId: rec0.platformId,
        kind: "install",
        level: ok ? "info" : "error",
        message: ok ? `已安装：${rec0.item.title} → ${rec?.install?.path}` : `安装失败：${rec0.item.title}`,
        meta: { gitUrl: rec?.install?.gitUrl, path: rec?.install?.path },
      });
      return NextResponse.json({ record: rec });
    }
    default:
      return NextResponse.json({ error: `未知操作 ${op}` }, { status: 400 });
  }
}

/** DELETE /api/intelligence-center/review/[id] —— 从队列移除 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ removed: removeRecord(id) });
}
