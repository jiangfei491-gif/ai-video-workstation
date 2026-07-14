import { NextResponse } from "next/server";
import { listPublicLyrics } from "@/app/lib/music-module/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const result = await listPublicLyrics({
    q: p.get("q") ?? undefined,
    category: p.get("category") ?? undefined,
    mood: p.get("mood") ?? undefined,
    scene: p.get("scene") ?? undefined,
    style: p.get("style") ?? undefined,
    theme: p.get("theme") ?? undefined,
    commercial: p.get("commercial") ?? undefined,
    minScore: p.get("minScore") ? Number(p.get("minScore")) : undefined,
    page: Number(p.get("page") ?? 1),
    pageSize: Number(p.get("pageSize") ?? 24),
  });
  return NextResponse.json(result);
}
