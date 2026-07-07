import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { desktopBgmPath, ensureDesktopVeoLayout, toDesktopFileUrl } from "@/app/lib/storage/desktop-veo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });
    }

    ensureDesktopVeoLayout();
    const ext = path.extname(file.name).toLowerCase() || ".mp3";
    const filename = `bgm-${Date.now()}${ext}`;
    const filepath = desktopBgmPath(filename);
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buf);

    const rel = path.join("BGM", filename);
    return NextResponse.json({ url: toDesktopFileUrl(rel), filename });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
