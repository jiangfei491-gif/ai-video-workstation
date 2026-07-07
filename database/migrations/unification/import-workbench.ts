import fs from "node:fs";

import type { IPgPool } from "../../repositories/pg/pool";
import { DEFAULT_PROJECT_ID, DEFAULT_USER_ID, DEFAULT_WORKSPACE_ID } from "./constants";
import { ensureDefaultIdentity, ensureDefaultProject } from "./bootstrap-db";

type WorkbenchExport = {
  t2v?: Record<string, unknown>;
  t2i?: Record<string, unknown>;
  uiState?: Record<string, unknown>;
};

export async function importWorkbenchExport(
  pool: IPgPool,
  exportPath: string
): Promise<number> {
  if (!fs.existsSync(exportPath)) return 0;
  await ensureDefaultIdentity(pool);
  await ensureDefaultProject(pool);

  const payload = JSON.parse(fs.readFileSync(exportPath, "utf8")) as WorkbenchExport;
  let count = 0;

  const t2v = payload.t2v ?? payload;
  if (t2v && typeof t2v === "object") {
    const topic = String((t2v as Record<string, unknown>).topic ?? "Imported Workbench");
    await pool.query(
      `UPDATE projects SET title = $2, topic = $3, updated_at = NOW() WHERE id = $1`,
      [DEFAULT_PROJECT_ID, topic.slice(0, 200), topic]
    );

    await pool.query(
      `INSERT INTO project_artifacts (project_id, artifact_kind, slug)
       VALUES ($1, 'edit_graph', 'workbench-import')
       ON CONFLICT (project_id, artifact_kind, slug) DO NOTHING`,
      [DEFAULT_PROJECT_ID]
    );

    const artifact = await pool.queryOne<{ id: string }>(
      "SELECT id FROM project_artifacts WHERE project_id = $1 AND artifact_kind = 'edit_graph' AND slug = 'workbench-import' LIMIT 1",
      [DEFAULT_PROJECT_ID]
    );

    if (artifact) {
      await pool.query(
        `INSERT INTO artifact_versions (artifact_id, version, payload, created_by)
         VALUES ($1, 1, $2, $3)
         ON CONFLICT (artifact_id, version) DO UPDATE SET payload = EXCLUDED.payload`,
        [artifact.id, JSON.stringify(t2v), DEFAULT_USER_ID]
      );
    }

    const existingSession = await pool.queryOne<{ id: string }>(
      "SELECT id FROM workbench_sessions WHERE user_id = $1 AND project_id = $2 LIMIT 1",
      [DEFAULT_USER_ID, DEFAULT_PROJECT_ID]
    );

    if (existingSession) {
      await pool.query(
        `UPDATE workbench_sessions SET ui_state = $2, sync_version = sync_version + 1, updated_at = NOW()
         WHERE id = $1`,
        [existingSession.id, JSON.stringify({ ...(payload.uiState ?? {}), workbench: t2v })]
      );
    } else {
      await pool.query(
        `INSERT INTO workbench_sessions (user_id, project_id, ui_state, current_page, layout, sync_version)
         VALUES ($1, $2, $3, 't2v', $4, 1)`,
        [
          DEFAULT_USER_ID,
          DEFAULT_PROJECT_ID,
          JSON.stringify({ ...(payload.uiState ?? {}), workbench: t2v }),
          JSON.stringify({ pipeline: "t2v" }),
        ]
      );
    }

    count += 1;
  }

  return count;
}
