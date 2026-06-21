import { NextResponse } from "next/server";
import { generateImageWithGptImage2 } from "@/app/lib/image/gpt-image-2";
import { getScene, updateSceneImage } from "@/app/lib/asset-library";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { id?: string };

/** 根据场景描述生成一张场景参考图（走 OpenAI gpt-image，与 Veo 额度无关） */
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

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "缺少场景 ID" }, { status: 400 });

  const scene = getScene(id);
  if (!scene) return NextResponse.json({ error: "场景不存在" }, { status: 404 });

  const prompt = `Establishing shot of an environment: ${scene.description}. No people. Cinematic, highly detailed, consistent art direction, atmospheric lighting, vertical 9:16 composition.`;

  try {
    const [image] = await generateImageWithGptImage2(prompt, "1024x1536", 1);
    const updated = updateSceneImage(id, image.buffer);
    return NextResponse.json({
      scene: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        refImageUrl: updated.refImageUrl ?? null,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "场景图生成失败" },
      { status: 502 }
    );
  }
}
