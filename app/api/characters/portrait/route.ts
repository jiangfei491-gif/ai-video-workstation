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

  // 专业角色设定图（角色设定图 / model sheet）：一张横版画布、多视图同脸，
  // 作为整部剧的一致性"标准答案"，每个镜头按需取角度/表情/服装。
  // 所有标签用简体中文，方便国内用户看懂。
  const prompt = `A professional character design model sheet (角色设定图) of one single character, laid out as multiple panels on one cohesive landscape canvas with a clean light neutral background.

The character: ${character.appearance}.

Include these panels, and render ALL panel titles and labels in Simplified Chinese exactly as written below:
1) 「主图」: one large cinematic main portrait (upper-left), set in an atmospheric environment/scene that fits the character (NOT a plain background) — moody cinematic lighting, rich depth and storytelling mood.
2) 「三视图」: full-body turnaround on a clean light background, with labels 「正面」「侧面」「背面」.
3) 「表情」: a row of 5 facial expression studies with labels 「平静」「微笑」「愤怒」「悲伤」「惊讶」.
4) 「服装变体」: two costume / outfit variations.
5) 「配色方案」: a small color-palette swatch bar.

CRITICAL REQUIREMENTS:
- Keep exactly the SAME face, hairstyle, body and identity consistent across every single panel.
- All titles and text labels MUST be accurate Simplified Chinese characters (no English, no garbled or fake characters).
- Cohesive color grading, cinematic lighting, highly detailed, professional concept-art quality.`;

  try {
    const [image] = await generateImageWithGptImage2(prompt, "1536x1024", 1);
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
