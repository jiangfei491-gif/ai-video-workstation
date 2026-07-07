import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addMaterialScript, getMaterial } from "@/app/lib/materials/store";
import {
  rewriteMaterialScript,
  rewriteModeLabel,
} from "@/app/lib/materials/script-evolution/rewrite";
import type { ScriptRewriteMode } from "@/app/lib/materials/script-evolution/types";
import { SCRIPT_REWRITE_MODES } from "@/app/lib/materials/script-evolution/types";
import { listAvailableProviders } from "@/app/lib/materials/script-evolution/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODES = new Set<ScriptRewriteMode>(SCRIPT_REWRITE_MODES.map((m) => m.id));

export async function POST(req: Request) {
  if (listAvailableProviders().length === 0) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY 或 VEO_API_KEY" }, { status: 503 });
  }

  let body: {
    materialId?: string;
    script?: string;
    mode?: string;
    baseTitle?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const materialId = body.materialId?.trim();
  const script = body.script?.trim();
  const mode = body.mode?.trim() as ScriptRewriteMode;

  if (!materialId) return NextResponse.json({ error: "缺少 materialId" }, { status: 400 });
  if (!script) return NextResponse.json({ error: "缺少脚本内容" }, { status: 400 });
  if (!mode || !MODES.has(mode)) {
    return NextResponse.json({ error: "无效的改写模式" }, { status: 400 });
  }

  const material = getMaterial(materialId);
  if (!material) return NextResponse.json({ error: "素材不存在" }, { status: 404 });

  try {
    const rewritten = await rewriteMaterialScript(material, script, mode);
    const label = rewriteModeLabel(mode);
    const baseTitle = body.baseTitle?.trim() || material.title;
    const updated = addMaterialScript(materialId, {
      id: randomUUID(),
      title: `${baseTitle} · ${label}`,
      script: rewritten,
      language: "zh",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ script: rewritten, mode, material: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "局部改写失败" },
      { status: 502 }
    );
  }
}
