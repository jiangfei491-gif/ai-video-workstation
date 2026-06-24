import { NextResponse } from "next/server";
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
} from "@/app/lib/materials/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ materials: listMaterials() });
}

type PostBody = {
  title?: string;
  content?: string;
  source?: string;
  url?: string;
  category?: string;
};

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "请填写标题" }, { status: 400 });
  }
  try {
    const material = createMaterial({
      title: body.title,
      content: body.content ?? "",
      source: body.source,
      url: body.url,
      category: body.category,
    });
    return NextResponse.json({ material });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });
  if (!deleteMaterial(id)) {
    return NextResponse.json({ error: "素材不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
