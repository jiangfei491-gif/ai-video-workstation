import { NextResponse } from "next/server";
import {
  appendWorkbenchActivity,
  getWorkbenchActivities,
  updateWorkbenchActivity,
} from "@/app/lib/workbench-activity/store";
import type { WorkbenchActivityAppend } from "@/app/lib/workbench-activity/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 全局工作台动态 — 谁在干什么、是否完成 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 120)));
  const since = url.searchParams.get("since")?.trim() || undefined;

  return NextResponse.json({
    activities: getWorkbenchActivities({ limit, since }),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WorkbenchActivityAppend;
    const row = appendWorkbenchActivity(body);
    return NextResponse.json({ activity: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      id: string;
      status?: WorkbenchActivityAppend["status"];
      message?: string;
      detail?: string;
    };
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }
    const row = updateWorkbenchActivity(body.id, {
      status: body.status,
      message: body.message,
      detail: body.detail,
    });
    if (!row) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    return NextResponse.json({ activity: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
