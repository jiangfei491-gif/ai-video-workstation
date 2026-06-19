import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  DESKTOP_VEO_ROOT,
  resolveDesktopFile,
} from "@/app/lib/storage/desktop-veo";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await ctx.params;
  const rel = segments.join("/");
  const filepath = resolveDesktopFile(rel);
  if (!filepath) {
    return NextResponse.json({ error: "文件未找到" }, { status: 404 });
  }

  const ext = path.extname(filepath).toLowerCase();
  let body: Buffer;
  try {
    body = await fs.promises.readFile(filepath);
  } catch {
    return NextResponse.json({ error: "文件未找到" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${path.basename(filepath)}"`,
    },
  });
}

export async function HEAD() {
  if (!fs.existsSync(DESKTOP_VEO_ROOT)) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, { status: 200 });
}
