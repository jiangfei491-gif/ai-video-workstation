import { NextResponse } from "next/server";
import { runDirectorPipeline } from "@/app/lib/director";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  topic?: string;
  shotCount?: number;
  imageBudget?: number;
  shotDurationSec?: number;
  script?: string;
  title?: string;
  pipelineMode?: "t2i" | "t2v" | "i2v";
  targetDurationMinutes?: number;
  characterIds?: string[];
  sceneIds?: string[];
  propIds?: string[];
  projectBible?: {
    videoType?: string;
    colorTone?: string;
    cameraLanguage?: string;
    lightingRules?: string;
    forbidden?: string;
  };
  projectStyle?: string;
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

  const pipelineMode = body.pipelineMode ?? "t2v";
  const shotCount =
    body.shotCount !== undefined
      ? Math.max(1, Math.floor(body.shotCount))
      : undefined;
  const imageBudget =
    body.imageBudget !== undefined
      ? Math.max(1, Math.floor(body.imageBudget))
      : undefined;
  const shotDurationSec =
    body.shotDurationSec !== undefined
      ? Math.max(1, Math.floor(body.shotDurationSec))
      : undefined;

  try {
    const result = await runDirectorPipeline({
      topic,
      shotCount,
      imageBudget,
      shotDurationSec,
      script: body.script?.trim() || undefined,
      title: body.title?.trim() || undefined,
      outputMode: pipelineMode === "t2i" ? "image" : "video",
      targetDurationMinutes: body.targetDurationMinutes,
      characterIds: body.characterIds,
      sceneIds: body.sceneIds,
      propIds: body.propIds,
      projectBible: body.projectBible,
      projectStyle: body.projectStyle?.trim(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "导演流水线生成失败" },
      { status: 502 }
    );
  }
}
