import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  generateImageWithGptImage2,
  type ImageSize,
} from "@/app/lib/image/gpt-image-2";
import {
  aspectToSize,
  buildImagePrompt,
  parseDimensions,
} from "@/app/lib/image-gen/types";
import type {
  ImageAspectRatio,
  ImageClarity,
  ImageStyle,
} from "@/app/lib/image-gen/types";
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
  topic?: string;
  prompt?: string;
  style?: ImageStyle;
  aspectRatio?: ImageAspectRatio;
  clarity?: ImageClarity;
  n?: number;
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
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const topic = body.topic?.trim() ?? "";
  const userPrompt = body.prompt?.trim() ?? topic;
  if (!userPrompt) {
    return NextResponse.json({ error: "请填写提示词或主题" }, { status: 400 });
  }

  const style = body.style ?? "realistic";
  const aspectRatio = body.aspectRatio ?? "9:16";
  const clarity = body.clarity ?? "hd";
  const n = Math.max(1, Math.min(8, body.n ?? 1));
  const workspaceMode = parseWorkspaceMode(body.workspaceMode);
  const prompt = buildImagePrompt(topic, userPrompt, style);
  const size = aspectToSize(aspectRatio, clarity) as ImageSize;
  const { width, height } = parseDimensions(size);

  try {
    const generated = await generateImageWithGptImage2(prompt, size, n);

    if (isPreviewMode(workspaceMode)) {
      const images = generated.map((g) => {
        const id = randomUUID();
        const previewUrl = `data:image/png;base64,${g.buffer.toString("base64")}`;
        return {
          id,
          source: g.source,
          prompt: userPrompt,
          previewUrl,
          publicUrl: previewUrl,
          width,
          height,
          model: g.model,
          createdAt: new Date().toISOString(),
          workspaceMode,
        };
      });
      return NextResponse.json({ images, prompt: userPrompt, topic, style, aspectRatio, clarity });
    }

    const images = generated.map((g) => {
      const asset = saveImageAsset({
        prompt: userPrompt,
        buffer: g.buffer,
        model: g.model,
        source: g.source,
        width,
        height,
      });
      return { ...asset, workspaceMode };
    });
    return NextResponse.json({ images, prompt: userPrompt, topic, style, aspectRatio, clarity });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生图失败" },
      { status: 502 }
    );
  }
}
