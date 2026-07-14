import { NextResponse } from "next/server";
import {
  addOriginalVersion,
  getOriginalLyric,
  listOriginalVersions,
} from "@/app/lib/music-module/repository";
import { createLyric } from "@/app/lib/music-module/gpt-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 重新生成：按原提示词重新创作，存为新版本 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lyric = await getOriginalLyric(id);
  if (!lyric) return NextResponse.json({ error: "歌词不存在" }, { status: 404 });
  let body: string;
  try {
    const gen = await createLyric(lyric.prompt);
    body = gen.body;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "重新生成失败" }, { status: 500 });
  }
  if (!body) return NextResponse.json({ error: "GPT 未返回歌词" }, { status: 500 });
  const versionId = await addOriginalVersion(id, body, "重新生成", "gpt");
  const versions = await listOriginalVersions(id);
  return NextResponse.json({ versionId, body, versions });
}
