import { NextResponse } from "next/server";
import {
  addOriginalVersion,
  getOriginalLyric,
  listOriginalVersions,
} from "@/app/lib/music-module/repository";
import { reviseLyric } from "@/app/lib/music-module/gpt-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 修改歌词：按用户指令修改，存为新版本 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { instruction } = await req.json();
  if (!instruction) return NextResponse.json({ error: "缺少修改指令" }, { status: 400 });
  const lyric = await getOriginalLyric(id);
  if (!lyric) return NextResponse.json({ error: "歌词不存在" }, { status: 404 });
  let body: string;
  try {
    const gen = await reviseLyric(lyric.body ?? "", instruction);
    body = gen.body;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "修改失败" }, { status: 500 });
  }
  const versionId = await addOriginalVersion(id, body, `修改：${String(instruction).slice(0, 40)}`, "gpt");
  const versions = await listOriginalVersions(id);
  return NextResponse.json({ versionId, body, versions });
}
