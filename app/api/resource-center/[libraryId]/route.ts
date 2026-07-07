import { NextResponse } from "next/server";

import { getLibraryManager, type LibraryId } from "@/app/lib/resource-center";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ libraryId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { libraryId } = await context.params;
  const manager = getLibraryManager();

  if (!manager.hasLibrary(libraryId)) {
    return NextResponse.json({ error: "未知内容库" }, { status: 404 });
  }

  const lib = manager.getLibrary(libraryId as LibraryId);
  lib.ensureLayout();
  const stats = await lib.getStats();
  const list = await lib.list();

  return NextResponse.json({
    ok: true,
    library: lib.definition,
    stats,
    items: list.items,
    total: list.total,
    phase: "V3",
  });
}
