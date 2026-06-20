import { NextResponse } from "next/server";
import { generateImageWithGptImage2 } from "@/app/lib/image/gpt-image-2";
import {
  expandCharacterRefsFromStore,
  saveImageAsset,
} from "@/app/lib/asset-library";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { prompt?: string };

/**
 * 就地生成分镜首帧（走 OpenAI gpt-image，与 Veo 额度无关）。
 * 提示词里的 @角色名 在生成前展开为外观锚点 —— 选角连线后帧里就是对应角色。
 */
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

  const raw = body.prompt?.trim();
  if (!raw) {
    return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
  }

  const expanded = expandCharacterRefsFromStore(raw);
  const prompt = `${expanded} Cinematic film still, vertical 9:16 composition, highly detailed, consistent character design, natural lighting.`;

  try {
    const [image] = await generateImageWithGptImage2(prompt, "1024x1536", 1);
    const asset = saveImageAsset({
      prompt,
      buffer: image.buffer,
      model: image.model,
      source: image.source,
      width: 1024,
      height: 1536,
    });
    return NextResponse.json({ url: asset.publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "首帧生成失败" },
      { status: 502 }
    );
  }
}
