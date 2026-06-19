import { NextResponse } from "next/server";
import { getCharacter, updateCharacterImage } from "@/app/lib/asset-library";
import { generateImageWithGptImage2 } from "@/app/lib/image/gpt-image-2";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { id?: string };

/** 根据角色外观描述生成一张角色参考图（走 OpenAI gpt-image，与 Veo 额度无关） */
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
  if (!id) {
    return NextResponse.json({ error: "缺少角色 ID" }, { status: 400 });
  }

  const character = getCharacter(id);
  if (!character) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }

  const prompt = `Character reference portrait of ${character.appearance}. Full-body, centered, plain neutral studio background, clean even lighting, character design sheet style, high detail.`;

  try {
    const [image] = await generateImageWithGptImage2(prompt, "1024x1536", 1);
    const updated = updateCharacterImage(id, image.buffer);
    return NextResponse.json({
      character: {
        id: updated.id,
        name: updated.name,
        appearance: updated.appearance,
        refImageUrl: updated.refImageUrl ?? null,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "角色图生成失败" },
      { status: 502 }
    );
  }
}
