import { NextResponse } from "next/server";
import { getActiveEditJob } from "@/app/lib/auto-edit/edit-job-store";

export const runtime = "nodejs";

export async function GET() {
  const job = getActiveEditJob();
  return NextResponse.json({ job });
}
