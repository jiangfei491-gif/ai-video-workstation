import { NextResponse } from "next/server";
import { generateShotFrame, type ShotFrameRequestBody } from "@/app/lib/director/generate-shot-frame";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import { recordCost } from "@/app/lib/cost-ledger/unified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json(
      { error: "未配置 OPENAI_API_KEY" },
      { status: 503 }
    );
  }

  let body: ShotFrameRequestBody;
  try {
    body = (await req.json()) as ShotFrameRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  try {
    const result = await generateShotFrame(body);
    // 记入全平台成本总账（生图按张粗算；具体供应商由结果决定，未暴露则记通用）
    try {
      const prov = (result as { provider?: string; model?: string }).provider;
      const model = (result as { model?: string }).model ?? prov ?? "image";
      const unit = prov?.includes("gpt-image") ? 0.05 : prov?.includes("schnell") ? 0.003 : 0.025;
      recordCost({
        module: "创作中心",
        operation: "生图",
        provider: prov ?? "image",
        model,
        units: 1,
        unitKind: "张",
        costUsd: unit,
        estimated: true,
      });
    } catch {
      /* 记账失败不影响返回 */
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生成失败" },
      { status: 502 }
    );
  }
}
