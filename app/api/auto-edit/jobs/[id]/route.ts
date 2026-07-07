import { NextResponse } from "next/server";
import { getEditJob } from "@/app/lib/auto-edit/edit-job-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const job = getEditJob(id);
  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
