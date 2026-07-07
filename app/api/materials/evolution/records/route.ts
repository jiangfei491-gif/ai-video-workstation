import { NextResponse } from "next/server";
import {
  getScriptRecord,
  listScriptRecords,
  updateScriptRecord,
} from "@/app/lib/materials/script-evolution/script-record-store";
import type { YoutubeMetrics } from "@/app/lib/materials/script-evolution/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  id?: string;
  selectedForPublish?: boolean;
  published?: boolean;
  videoUrl?: string;
  humanScore?: number;
  humanNote?: string;
  youtubeMetrics?: YoutubeMetrics;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const materialId = url.searchParams.get("materialId")?.trim();
  const evolutionRunId = url.searchParams.get("evolutionRunId")?.trim();
  const role = url.searchParams.get("role")?.trim();

  let records = listScriptRecords({ materialId, evolutionRunId, limit: 100 });
  if (role) records = records.filter((r) => r.role === role);
  return NextResponse.json({ records });
}

export async function PATCH(req: Request) {
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  if (!getScriptRecord(id)) {
    return NextResponse.json({ error: "脚本记录不存在" }, { status: 404 });
  }

  try {
    const record = updateScriptRecord(id, {
      selectedForPublish: body.selectedForPublish,
      published: body.published,
      videoUrl: body.videoUrl?.trim() || undefined,
      humanScore: body.humanScore,
      humanNote: body.humanNote?.trim() || undefined,
      youtubeMetrics: body.youtubeMetrics,
    });
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失败" },
      { status: 400 }
    );
  }
}
