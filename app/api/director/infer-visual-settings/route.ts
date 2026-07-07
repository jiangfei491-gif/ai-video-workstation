import { NextResponse } from "next/server";
import { inferVisualSettings } from "@/app/lib/director/infer-visual-settings";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  topic?: string;
  title?: string;
  script?: string;
};

export async function POST(req: Request) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json(
      { error: "未配置 OPENAI_API_KEY" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const script = body.script?.trim();
  if (!script) {
    return NextResponse.json({ error: "请提供脚本内容" }, { status: 400 });
  }

  const topic = body.topic?.trim() || "未命名项目";
  const title = body.title?.trim() || topic;

  try {
    const visualResult = await inferVisualSettings({ topic, title, script });
    return NextResponse.json({ visualSettings: visualResult.settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "视觉设定推断失败" },
      { status: 502 }
    );
  }
}
