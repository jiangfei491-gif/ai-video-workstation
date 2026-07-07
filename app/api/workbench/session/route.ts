import { NextResponse } from "next/server";

import { DEFAULT_PROJECT_ID, DEFAULT_USER_ID } from "@/database/migrations/unification/constants";
import { createPgPool } from "@/database/repositories/pg/pool";

export const runtime = "nodejs";

async function readSession(): Promise<Record<string, unknown> | null> {
  const pool = createPgPool();
  try {
    const row = await pool.queryOne<{ ui_state: Record<string, unknown> }>(
      `SELECT ui_state FROM workbench_sessions WHERE user_id = $1 AND project_id = $2 ORDER BY updated_at DESC LIMIT 1`,
      [DEFAULT_USER_ID, DEFAULT_PROJECT_ID]
    );
    const ui = row?.ui_state ?? {};
    const wb = ui.workbench as Record<string, unknown> | undefined;
    return wb ?? ui;
  } finally {
    await pool.end();
  }
}

async function writeSession(state: unknown): Promise<void> {
  const pool = createPgPool();
  try {
    const existing = await pool.queryOne<{ id: string }>(
      `SELECT id FROM workbench_sessions WHERE user_id = $1 AND project_id = $2 LIMIT 1`,
      [DEFAULT_USER_ID, DEFAULT_PROJECT_ID]
    );
    const payload = JSON.stringify({ workbench: state });
    if (existing) {
      await pool.query(
        `UPDATE workbench_sessions SET ui_state = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW() WHERE id = $1`,
        [existing.id, payload]
      );
    } else {
      await pool.query(
        `INSERT INTO workbench_sessions (user_id, project_id, ui_state, current_page, layout, sync_version)
         VALUES ($1, $2, $3::jsonb, 't2v', '{}', 1)`,
        [DEFAULT_USER_ID, DEFAULT_PROJECT_ID, payload]
      );
    }
  } finally {
    await pool.end();
  }
}

export async function GET() {
  const state = await readSession();
  return NextResponse.json({ unified: true, state });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { state?: unknown };
  if (!body.state) {
    return NextResponse.json({ error: "缺少 state" }, { status: 400 });
  }
  await writeSession(body.state);
  return NextResponse.json({ ok: true });
}
