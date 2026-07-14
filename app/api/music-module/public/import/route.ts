import { NextResponse } from "next/server";
import { extractSeedsFromPaste } from "@/app/lib/music-module/import-parser";
import { saveImportedSeeds } from "@/app/lib/music-module/imported-seeds";
import { getSeedProgress, upsertSeedStatus } from "@/app/lib/music-module/seed-store";
import { runPublicSync } from "@/app/lib/music-module/sync-service";
import type { MusicSeedTrack } from "@/app/lib/music-module/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** POST —— 粘贴提取 / 确认并入库 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: "extract" | "confirm";
      text?: string;
      tracks?: MusicSeedTrack[];
    };

    if (body.action === "extract") {
      if (!body.text?.trim()) {
        return NextResponse.json({ error: "请先粘贴内容" }, { status: 400 });
      }
      const result = await extractSeedsFromPaste(body.text);
      return NextResponse.json(result);
    }

    if (body.action === "confirm") {
      const tracks = Array.isArray(body.tracks) ? body.tracks : [];
      if (!tracks.length) {
        return NextResponse.json({ error: "没有可入库的曲目" }, { status: 400 });
      }
      const saved = await saveImportedSeeds(tracks);
      for (const t of tracks) {
        await upsertSeedStatus(t.id, "pending");
      }
      const syncResult = await runPublicSync("import", undefined, { limit: tracks.length });
      const seedProgress = await getSeedProgress();
      return NextResponse.json({ saved, syncResult, seedProgress });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
