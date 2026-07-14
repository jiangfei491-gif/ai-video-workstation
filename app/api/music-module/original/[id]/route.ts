import { NextResponse } from "next/server";
import {
  deleteOriginalLyric,
  getOriginalLyric,
  listOriginalVersions,
  saveOriginalEdit,
} from "@/app/lib/music-module/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lyric = await getOriginalLyric(id);
  if (!lyric) return NextResponse.json({ error: "歌词不存在" }, { status: 404 });
  const versions = await listOriginalVersions(id);
  return NextResponse.json({ lyric, versions });
}

/** PATCH —— 保存手动编辑（作为新版本） */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (typeof body.body !== "string") return NextResponse.json({ error: "缺少 body" }, { status: 400 });
  const versionId = await saveOriginalEdit(id, body.body, body.title);
  const lyric = await getOriginalLyric(id);
  const versions = await listOriginalVersions(id);
  return NextResponse.json({ versionId, lyric, versions });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteOriginalLyric(id);
  return NextResponse.json({ ok: true });
}
