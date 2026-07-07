import { NextResponse } from "next/server";
import { listMaterialSearchProviders } from "@/app/lib/materials/material-search-providers";
import { runMaterialAgentJob } from "@/app/lib/materials/run-agent-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  task?: string;
  count?: number;
  category?: string;
  language?: string;
  searchProvider?: string;
  autoAnalyze?: boolean;
};

export async function POST(req: Request) {
  if (listMaterialSearchProviders().length === 0) {
    return NextResponse.json(
      { error: "未配置找素材模型（需要 OPENAI_API_KEY 或 VEO_API_KEY）" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const task = body.task?.trim();
  if (!task) return NextResponse.json({ error: "请填写任务（要找什么素材）" }, { status: 400 });

  try {
    const result = await runMaterialAgentJob({
      task,
      count: body.count,
      category: body.category,
      language: body.language,
      searchProvider: body.searchProvider,
      autoAnalyze: body.autoAnalyze,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent 运行失败" },
      { status: 502 }
    );
  }
}
