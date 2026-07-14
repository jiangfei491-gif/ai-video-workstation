import { NextResponse } from "next/server";

import { restoreShotFramesFromImageAssets } from "@/app/lib/image-task/restore-frames-from-assets";
import { DEFAULT_PROJECT_ID, DEFAULT_USER_ID } from "@/database/migrations/unification/constants";
import { createPgPool } from "@/database/repositories/pg/pool";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

export async function POST() {
  const pool = createPgPool();
  try {
    const row = await pool.queryOne<{ id: string; ui_state: { workbench?: T2VWorkbenchState } }>(
      `SELECT id, ui_state FROM workbench_sessions WHERE user_id = $1 AND project_id = $2 ORDER BY updated_at DESC LIMIT 1`,
      [DEFAULT_USER_ID, DEFAULT_PROJECT_ID]
    );
    if (!row?.ui_state?.workbench) {
      return NextResponse.json({ error: "无工作台状态" }, { status: 404 });
    }

    const wb = row.ui_state.workbench;
    const { patch, matched, matchedByPrompt, matchedByOrder, unmatched, totalShots } =
      restoreShotFramesFromImageAssets(wb);
    const next = { ...wb, ...patch };

    await pool.query(
      `UPDATE workbench_sessions SET ui_state = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW() WHERE id = $1`,
      [row.id, JSON.stringify({ workbench: next })]
    );

    return NextResponse.json({
      ok: true,
      matched,
      matchedByPrompt,
      matchedByOrder,
      unmatched,
      totalShots,
      shotFrameCount: Object.keys(next.shotFrames ?? {}).length,
    });
  } finally {
    await pool.end();
  }
}
