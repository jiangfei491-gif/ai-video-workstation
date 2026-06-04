import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateImageWithGptImage2 } from "@/app/lib/image/gpt-image-2";
import { listImageAssets, saveImageAsset } from "@/app/lib/asset-library";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import {
  isPreviewMode,
  parseWorkspaceMode,
  type WorkspaceMode,
} from "@/app/lib/workspace-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  prompt?: string;
  workspaceMode?: WorkspaceMode;
};

export async function GET() {
  return NextResponse.json({ images: listImageAssets() });
}

export async function POST(req: Request) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const workspaceMode = parseWorkspaceMode(body.workspaceMode);

  try {
    const generated = await generateImageWithGptImage2(prompt);

    if (isPreviewMode(workspaceMode)) {
      const id = randomUUID();
      const previewUrl = `data:image/png;base64,${generated.buffer.toString("base64")}`;
      return NextResponse.json({
        id,
        source: generated.source,
        prompt,
        previewUrl,
        publicUrl: previewUrl,
        width: 1024,
        height: 1536,
        model: generated.model,
        createdAt: new Date().toISOString(),
        workspaceMode,
      });
    }

    const asset = saveImageAsset({
      prompt,
      buffer: generated.buffer,
      model: generated.model,
      source: generated.source,
    });
    return NextResponse.json({ ...asset, workspaceMode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生图失败" },
      { status: 502 }
    );
  }
}
