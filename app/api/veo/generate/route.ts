import { NextResponse } from "next/server";
import { generateWithVeo } from "@/app/lib/veo";
import { ShotLockValidationError } from "@/app/lib/shot-lock";
import type { VeoGenerateRequest } from "@/app/lib/shot-lock";
import { getVeoConfig, isVeoConfigured } from "@/app/lib/veo/config";
import { parseWorkspaceMode } from "@/app/lib/workspace-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: Request) {
  const config = getVeoConfig();
  if (!isVeoConfigured(config)) {
    return NextResponse.json({ error: "未配置 VEO_API_KEY" }, { status: 503 });
  }

  let body: VeoGenerateRequest;
  try {
    body = (await req.json()) as VeoGenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  body.workspaceMode = parseWorkspaceMode(body.workspaceMode);

  if (!body.shotId?.trim() || !body.prompt?.trim()) {
    return NextResponse.json(
      { error: "shotId and prompt are required" },
      { status: 400 }
    );
  }
  if (!body.mode || !body.type) {
    return NextResponse.json(
      { error: "mode and type are required" },
      { status: 400 }
    );
  }

  try {
    const result = await generateWithVeo(body);
    if (result.status === "failed") {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShotLockValidationError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Veo 生成失败" },
      { status: 502 }
    );
  }
}
