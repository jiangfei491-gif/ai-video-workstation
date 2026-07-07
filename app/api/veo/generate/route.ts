import { NextResponse } from "next/server";
import { generateWithVeo } from "@/app/lib/veo";
import { ShotLockValidationError } from "@/app/lib/shot-lock";
import type { VeoGenerateRequest } from "@/app/lib/shot-lock";
import { getVeoConfig, isVeoConfigured } from "@/app/lib/veo/config";
import { parseWorkspaceMode } from "@/app/lib/workspace-mode";
import { recordUnitCost, UNIT_PRICING } from "@/app/lib/cost-ledger/unified";

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
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  body.workspaceMode = parseWorkspaceMode(body.workspaceMode);

  if (!body.shotId?.trim() || !body.prompt?.trim()) {
    return NextResponse.json(
      { error: "缺少镜头 ID 或提示词" },
      { status: 400 }
    );
  }
  if (!body.mode || !body.type) {
    return NextResponse.json(
      { error: "缺少模式或类型参数" },
      { status: 400 }
    );
  }

  try {
    const result = await generateWithVeo(body);
    if (result.status === "failed") {
      return NextResponse.json(result, { status: 502 });
    }
    // 记入全平台成本总账（Veo 按秒粗算）
    try {
      const secs =
        Number((body as { durationSec?: number }).durationSec) ||
        Number(config.durationSeconds) ||
        8;
      recordUnitCost(
        "创作中心",
        body.mode === "test" ? "生视频（预览）" : "生视频",
        "veo",
        process.env.VEO_MODEL_ID?.trim() || "veo",
        secs,
        UNIT_PRICING["veo-per-sec"],
        "秒",
        { taskId: (result as { taskId?: string }).taskId }
      );
    } catch {
      /* 记账失败不影响返回 */
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShotLockValidationError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "视频生成失败" },
      { status: 502 }
    );
  }
}
