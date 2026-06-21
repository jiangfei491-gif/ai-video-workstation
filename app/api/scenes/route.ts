import { NextResponse } from "next/server";
import { createScene, deleteScene, listScenes } from "@/app/lib/asset-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DATA_URL_LENGTH = 14_000_000;

function publicShape(s: {
  id: string;
  name: string;
  description: string;
  refImageUrl?: string;
  createdAt: string;
}) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    refImageUrl: s.refImageUrl ?? null,
    createdAt: s.createdAt,
  };
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ scenes: listScenes().map(publicShape) });
}

type PostBody = { name?: string; description?: string; imageDataUrl?: string };

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "请填写场景名" }, { status: 400 });

  const description = body.description?.trim() ?? "";
  if (!description) {
    return NextResponse.json({ error: "请填写场景描述" }, { status: 400 });
  }

  let imageBuffer: Buffer | undefined;
  const imageDataUrl = body.imageDataUrl?.trim();
  if (imageDataUrl) {
    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "参考图格式无效" }, { status: 400 });
    }
    if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "参考图过大" }, { status: 413 });
    }
    imageBuffer = dataUrlToBuffer(imageDataUrl) ?? undefined;
  }

  try {
    const scene = createScene({ name, description, imageBuffer });
    return NextResponse.json({ scene: publicShape(scene) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建场景失败" },
      { status: 409 }
    );
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少场景 ID" }, { status: 400 });
  if (!deleteScene(id)) {
    return NextResponse.json({ error: "场景不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
