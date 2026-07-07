import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateMaterialScript } from "@/app/lib/materials/generate-script";
import {
  addMaterialScript,
  deleteMaterialScript,
  getMaterial,
} from "@/app/lib/materials/store";
import { listAvailableProviders } from "@/app/lib/materials/script-evolution/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (listAvailableProviders().length === 0) {
    return NextResponse.json(
      { error: "内容中心未配置 AI（需 ANTHROPIC_API_KEY 或 OPENAI_API_KEY）" },
      { status: 503 }
    );
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

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const materialId = url.searchParams.get("materialId")?.trim();
  const scriptId = url.searchParams.get("scriptId")?.trim();

  if (!materialId) {
    return NextResponse.json({ error: "缺少 materialId" }, { status: 400 });
  }
  if (!scriptId) {
    return NextResponse.json({ error: "缺少 scriptId" }, { status: 400 });
  }

  if (!getMaterial(materialId)) {
    return NextResponse.json({ error: "素材不存在" }, { status: 404 });
  }

  try {
    const material = deleteMaterialScript(materialId, scriptId);
    return NextResponse.json({ material });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "删除失败" },
      { status: 404 }
    );
  }
}
