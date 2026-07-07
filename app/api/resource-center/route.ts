import { NextResponse } from "next/server";

import {
  getLibraryManager,
  LIBRARY_DEFINITIONS,
  RESOURCE_CENTER_LIBRARY_REL,
} from "@/app/lib/resource-center";

export const runtime = "nodejs";

export async function GET() {
  const manager = getLibraryManager();
  const manifest = manager.ensureAllLayouts();
  const stats = await manager.getGlobalStats();

  return NextResponse.json({
    ok: true,
    version: 1,
    title: "Resource Center",
    titleZh: "资源中心",
    description: "AI Video OS 唯一资源入口 — 12 大内容库",
    workspaceRoot: manifest.workspaceRoot,
    storageRoot: "storage/library",
    directories: RESOURCE_CENTER_LIBRARY_REL,
    libraries: LIBRARY_DEFINITIONS.map((def) => ({
      id: def.id,
      slug: def.slug,
      title: def.title,
      titleZh: def.titleZh,
      description: def.description,
      storageDir: def.storageDir,
      categories: def.categories,
      capabilities: def.capabilities,
      dbMapping: def.dbMapping,
      stats: stats.byLibrary[def.id],
    })),
    globalStats: {
      totalLibraries: stats.totalLibraries,
      totalResources: stats.totalResources,
      totalDbRecords: stats.totalDbRecords,
    },
    phase: "V3",
    pipeline: ["source", "crawler", "scheduler", "downloader", "ai-analyzer", "library-manager", "ai-resource-service"],
    deepseek: { analyzer: true },
    excluded: ["tagger", "deduplicator", "scheduler"],
  });
}
