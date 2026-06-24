import { NextResponse } from "next/server";
import { patchMaterial } from "@/app/lib/materials/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  favorite?: boolean;
  status?: string;
  category?: string;
};

const STATUSES = ["待分析", "已分析", "已生成脚本", "已生成视频"];

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });

  const patch: { favorite?: boolean; status?: import("@/app/lib/materials/types").MaterialStatus; category?: string } = {};
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;
  if (body.status && STATUSES.includes(body.status)) patch.status = body.status as import("@/app/lib/materials/types").MaterialStatus;
  if (body.category) patch.category = body.category;

  try {
    const material = patchMaterial(id, patch);
    return NextResponse.json({ material });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失败" },
      { status: 404 }
    );
  }
}
