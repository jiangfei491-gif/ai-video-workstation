import { NextResponse } from "next/server";
import { getPublicLyric } from "@/app/lib/music-module/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lyric = await getPublicLyric(id);
  if (!lyric) return NextResponse.json({ error: "歌词不存在" }, { status: 404 });
  return NextResponse.json({ lyric });
}
