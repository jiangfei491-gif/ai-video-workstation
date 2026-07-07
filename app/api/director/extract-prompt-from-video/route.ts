import { NextResponse } from "next/server";
import fs from "fs";
import { randomUUID } from "crypto";
import { extractPromptFromVideoFrames } from "@/app/lib/director/extract-prompt-from-video";
import { extractFramesFromVideo } from "@/app/lib/veo/first-frame";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import { tempFilePath } from "@/app/lib/storage/workspace-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// 视频上传上限 ~60MB
const MAX_BYTES = 60 * 1024 * 1024;
const FRAME_COUNT = 5;

export async function POST(req: Request) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("video");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "请上传视频文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "视频过大（上限 60MB），请压缩后重试" }, { status: 413 });
  }

  const tmpVideo = tempFilePath(`v2p-${randomUUID()}.mp4`);
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpVideo, bytes);

    const frames = extractFramesFromVideo(tmpVideo, FRAME_COUNT);
    const frameDataUrls = frames.map(
      (buf) => `data:image/png;base64,${buf.toString("base64")}`
    );

    const prompt = await extractPromptFromVideoFrames(frameDataUrls);
    return NextResponse.json({ prompt, frameCount: frames.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "视频反推失败" },
      { status: 502 }
    );
  } finally {
    try {
      if (fs.existsSync(tmpVideo)) fs.unlinkSync(tmpVideo);
    } catch {
      /* ignore */
    }
  }
}
