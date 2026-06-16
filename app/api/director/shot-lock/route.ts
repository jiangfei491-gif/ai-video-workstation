import { NextResponse } from "next/server";
import {
  createShotLock,
  deleteShotLock,
  getShotLockByShotId,
  type CreateShotLockInput,
} from "@/app/lib/shot-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<keyof CreateShotLockInput, string> = {
  shotId: "镜头 ID",
  prompt: "提示词",
  seed: "随机种子",
  firstFrameAssetId: "首帧资源 ID",
  firstFrameUrl: "首帧地址",
  duration: "时长",
  aspectRatio: "画面比例",
  model: "模型",
  testTaskId: "测试任务 ID",
  testClipUrl: "测试片段地址",
  characterProfile: "角色设定",
  cameraProfile: "镜头设定",
  imageAssetId: "参考图资源 ID",
};

export async function POST(req: Request) {
  let body: CreateShotLockInput;
  try {
    body = (await req.json()) as CreateShotLockInput;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const required: (keyof CreateShotLockInput)[] = [
    "shotId",
    "prompt",
    "seed",
    "firstFrameAssetId",
    "firstFrameUrl",
    "duration",
    "aspectRatio",
    "model",
    "testTaskId",
    "testClipUrl",
  ];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      const label = FIELD_LABELS[key] ?? key;
      return NextResponse.json({ error: `缺少必填项：${label}` }, { status: 400 });
    }
  }

  const record = createShotLock(body);
  return NextResponse.json(record);
}

export async function GET(req: Request) {
  const shotId = new URL(req.url).searchParams.get("shotId");
  if (!shotId) {
    return NextResponse.json({ error: "请提供镜头 ID 参数" }, { status: 400 });
  }
  const record = getShotLockByShotId(shotId);
  if (!record) {
    return NextResponse.json({ error: "镜头锁定未找到" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(req: Request) {
  const shotId = new URL(req.url).searchParams.get("shotId");
  if (!shotId) {
    return NextResponse.json({ error: "请提供镜头 ID 参数" }, { status: 400 });
  }
  const ok = deleteShotLock(shotId);
  if (!ok) return NextResponse.json({ error: "镜头锁定未找到" }, { status: 404 });
  return NextResponse.json({ success: true });
}
