import { NextResponse } from "next/server";
import { generateImageWithGptImage2 } from "@/app/lib/image/gpt-image-2";
import {
  expandAllRefsFromStore,
  saveImageAsset,
} from "@/app/lib/asset-library";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { prompt?: string; count?: number; style?: string };

/**
 * 就地生成分镜首帧（走 OpenAI gpt-image，与 Veo 额度无关）。
 * - @角色名 生成前展开为外观锚点（选角后帧里即对应角色）
 * - style = 全片风格 DNA，注入以统一色调/风格
 * - count > 1 一次扇出多个变体
 * 返回 { frames: [{ url, assetId }] }（assetId 供后续 i2v 当参考图）
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
  const count = Math.max(1, Math.min(4, Math.floor(body.count ?? 1)));
  const style = body.style?.trim();

  const expanded = expandAllRefsFromStore(raw);
  const prompt = [
    expanded,
    style ? `Overall style: ${style}.` : "",
    "Cinematic film still, vertical 9:16 composition, highly detailed, consistent character design, natural lighting.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const images = await generateImageWithGptImage2(prompt, "1024x1536", count);
    const frames = images.map((image) => {
      const asset = saveImageAsset({
        prompt,
        buffer: image.buffer,
        model: image.model,
        source: image.source,
        width: 1024,
        height: 1536,
      });
      return { url: asset.publicUrl, assetId: asset.id };
    });
    return NextResponse.json({ frames });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "首帧生成失败" },
      { status: 502 }
    );
  }
}
