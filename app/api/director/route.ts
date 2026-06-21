import { NextResponse } from "next/server";
import { runDirectorPipeline } from "@/app/lib/director";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  topic?: string;
  shotCount?: number;
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

  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "请填写主题" }, { status: 400 });
  }

  const shotCount =
    body.shotCount !== undefined
      ? Math.max(1, Math.min(30, Math.floor(body.shotCount)))
      : undefined;

  try {
    const result = await runDirectorPipeline({ topic, shotCount });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "导演流水线生成失败" },
      { status: 502 }
    );
  }
}
