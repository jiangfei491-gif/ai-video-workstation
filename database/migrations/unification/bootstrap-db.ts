import type { IPgPool } from "../../repositories/pg/pool";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_SLUG,
  DEFAULT_USER_ID,
  DEFAULT_WORKSPACE_ID,
} from "./constants";

export async function ensureDefaultIdentity(pool: IPgPool): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, email, display_name)
     VALUES ($1, 'local@ai-video-os.local', 'Local User')
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_USER_ID]
  );

  await pool.query(
    `INSERT INTO workspaces (id, slug, name, owner_user_id)
     VALUES ($1, 'default', 'AI Video OS', $2)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_WORKSPACE_ID, DEFAULT_USER_ID]
  );

  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [DEFAULT_WORKSPACE_ID, DEFAULT_USER_ID]
  );
}

export async function ensureDefaultProject(pool: IPgPool): Promise<void> {
  await pool.query(
    `INSERT INTO projects (id, workspace_id, title, topic, status, pipeline_mode, created_by)
     VALUES ($1, $2, 'Legacy Import', 'Migrated from Desktop AI-Veo', 'active', 't2v', $3)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_PROJECT_ID, DEFAULT_WORKSPACE_ID, DEFAULT_USER_ID]
  );

  await pool.query(
    `INSERT INTO project_settings (project_id)
     VALUES ($1)
     ON CONFLICT (project_id) DO NOTHING`,
    [DEFAULT_PROJECT_ID]
  );

  await pool.query(
    `UPDATE workspaces SET settings = settings || $2::jsonb WHERE id = $1`,
    [
      DEFAULT_WORKSPACE_ID,
      JSON.stringify({ defaultProjectSlug: DEFAULT_PROJECT_SLUG, defaultProjectId: DEFAULT_PROJECT_ID }),
    ]
  );
}

export async function tableCount(pool: IPgPool, table: string): Promise<number> {
  const row = await pool.queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
  return Number(row?.count ?? 0);
}
