import { NextResponse } from "next/server";
import { extractPromptFromImage } from "@/app/lib/director";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  /** data:image/...;base64,... 形式的图片 */
  imageDataUrl?: string;
};

// 限制上传体积，避免超大图打爆内存（约 10MB base64）
const MAX_DATA_URL_LENGTH = 14_000_000;

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

  const imageDataUrl = body.imageDataUrl?.trim();
  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "请上传有效的参考图" }, { status: 400 });
  }
  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "参考图过大，请压缩后重试" }, { status: 413 });
  }

  try {
    const blueprint = await extractPromptFromImage(imageDataUrl);
    return NextResponse.json({ blueprint });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "反推失败" },
      { status: 502 }
    );
  }
}
