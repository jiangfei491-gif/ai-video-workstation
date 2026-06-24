import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateMaterialScript } from "@/app/lib/materials/generate-script";
import { addMaterialScript, getMaterial } from "@/app/lib/materials/store";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }
  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });
  const material = getMaterial(id);
  if (!material) return NextResponse.json({ error: "素材不存在" }, { status: 404 });

  try {
    const script = await generateMaterialScript(material);
    const updated = addMaterialScript(id, {
      id: randomUUID(),
      title: material.title,
      script,
      language: "zh",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ material: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "脚本生成失败" },
      { status: 502 }
    );
  }
}
