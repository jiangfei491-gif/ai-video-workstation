import { NextResponse } from "next/server";
import { createOriginalLyric, listOriginalLyrics } from "@/app/lib/music-module/repository";
import { createLyric } from "@/app/lib/music-module/gpt-agent";
import type { OriginalPrompt } from "@/app/lib/music-module/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const result = await listOriginalLyrics(undefined, Number(p.get("page") ?? 1), Number(p.get("pageSize") ?? 30));
  return NextResponse.json(result);
}

/** POST —— 用户提示词 → GPT 创作原创歌词 */
export async function POST(req: Request) {
  const prompt = (await req.json()) as OriginalPrompt;
  let gen: Awaited<ReturnType<typeof createLyric>>;
  try {
    gen = await createLyric(prompt);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "创作失败" }, { status: 500 });
  }
  if (!gen.body) return NextResponse.json({ error: "GPT 未返回歌词" }, { status: 500 });
  const lyric = await createOriginalLyric(gen.title, gen.body, prompt, {
    titleZh: gen.titleZh,
    lyricZhRemark: gen.lyricZhRemark,
  });
  return NextResponse.json({ lyric: { ...lyric, body: gen.body } });
}
