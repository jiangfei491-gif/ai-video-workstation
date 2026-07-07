import { NextResponse } from "next/server";

import { isWorkspaceUnified } from "@/database/migrations/unification/unified-mode";
import { getWorkspaceManager } from "@/database/workspace";

export const runtime = "nodejs";

export async function GET() {
  const ws = getWorkspaceManager();
  const cfg = ws.loadConfig();
  return NextResponse.json({
    unified: isWorkspaceUnified(),
    workspaceRoot: ws.workspaceRoot,
    defaultProjectId: cfg.defaultProjectId ?? null,
    defaultWorkspaceId: cfg.defaultWorkspaceId ?? null,
  });
}
