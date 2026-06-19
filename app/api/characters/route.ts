import { NextResponse } from "next/server";
import {
  createCharacter,
  deleteCharacter,
  extractCharacterAppearance,
  listCharacters,
} from "@/app/lib/asset-library";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DATA_URL_LENGTH = 14_000_000;

/** 对外返回时隐藏本地绝对路径 */
function publicShape(c: {
  id: string;
  name: string;
  appearance: string;
  refImageUrl?: string;
  createdAt: string;
}) {
  return {
    id: c.id,
    name: c.name,
    appearance: c.appearance,
    refImageUrl: c.refImageUrl ?? null,
    createdAt: c.createdAt,
  };
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ characters: listCharacters().map(publicShape) });
}

type PostBody = {
  name?: string;
  appearance?: string;
  imageDataUrl?: string;
};

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "请填写角色名" }, { status: 400 });
  }

  const imageDataUrl = body.imageDataUrl?.trim();
  let imageBuffer: Buffer | undefined;
  if (imageDataUrl) {
    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "参考图格式无效" }, { status: 400 });
    }
    if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "参考图过大，请压缩后重试" }, { status: 413 });
    }
    imageBuffer = dataUrlToBuffer(imageDataUrl) ?? undefined;
  }

  // 没填外观但有参考图 → 视觉自动提炼外观锚点
  let appearance = body.appearance?.trim() ?? "";
  if (!appearance && imageDataUrl) {
    if (!getOpenAIApiKey()) {
      return NextResponse.json(
        { error: "未配置 OPENAI_API_KEY，无法自动提炼外观，请手填外观描述" },
        { status: 503 }
      );
    }
    try {
      appearance = await extractCharacterAppearance(imageDataUrl);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "外观提炼失败" },
        { status: 502 }
      );
    }
  }

  if (!appearance) {
    return NextResponse.json(
      { error: "请填写外观描述，或上传参考图自动提炼" },
      { status: 400 }
    );
  }

  try {
    const character = createCharacter({ name, appearance, imageBuffer });
    return NextResponse.json({ character: publicShape(character) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建角色失败" },
      { status: 409 }
    );
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少角色 ID" }, { status: 400 });
  }
  const ok = deleteCharacter(id);
  if (!ok) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
