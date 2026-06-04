import { NextResponse } from "next/server";
import {
  createShotLock,
  deleteShotLock,
  getShotLockByShotId,
  type CreateShotLockInput,
} from "@/app/lib/shot-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: CreateShotLockInput;
  try {
    body = (await req.json()) as CreateShotLockInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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
      return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }
  }

  const record = createShotLock(body);
  return NextResponse.json(record);
}

export async function GET(req: Request) {
  const shotId = new URL(req.url).searchParams.get("shotId");
  if (!shotId) {
    return NextResponse.json({ error: "shotId query required" }, { status: 400 });
  }
  const record = getShotLockByShotId(shotId);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(req: Request) {
  const shotId = new URL(req.url).searchParams.get("shotId");
  if (!shotId) {
    return NextResponse.json({ error: "shotId query required" }, { status: 400 });
  }
  const ok = deleteShotLock(shotId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
