import { NextResponse } from "next/server";
import { saveImageAsset } from "@/app/lib/asset-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DATA_URL_LENGTH = 14_000_000;

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

type Body = { imageDataUrl?: string };

/** 把画布参考图便签存到桌面，返回小体积 /api/files url（避免 data URL 撑爆本地存储） */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const imageDataUrl = body.imageDataUrl?.trim();
  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "请上传有效图片" }, { status: 400 });
  }
  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "图片过大" }, { status: 413 });
  }

  const buffer = dataUrlToBuffer(imageDataUrl);
  if (!buffer) {
    return NextResponse.json({ error: "图片解码失败" }, { status: 400 });
  }

  try {
    const asset = saveImageAsset({ prompt: "canvas-ref", buffer, model: "upload" });
    return NextResponse.json({ url: asset.publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "保存失败" },
      { status: 500 }
    );
  }
}
