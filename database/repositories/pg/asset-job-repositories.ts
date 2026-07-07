import type { IPgPool } from "./pool";
import type {
  IAssetRepository,
  IJobRepository,
  PageParams,
  PageResult,
  UUID,
} from "../interfaces";

export class PgAssetRepository implements IAssetRepository {
  constructor(private readonly pool: IPgPool) {}

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO assets (workspace_id, project_id, kind, storage_bucket, storage_key, mime_type, size_bytes, sha256, legacy_filepath, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        i.workspace_id,
        i.project_id ?? null,
        i.kind ?? "image",
        i.storage_bucket ?? "ai-cut",
        i.storage_key,
        i.mime_type ?? null,
        i.size_bytes ?? null,
        i.sha256 ?? null,
        i.legacy_filepath ?? null,
        i.metadata ?? {},
      ]
    );
  }

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM assets WHERE id = $1", [id]);
  }

  async findByStorageKey(bucket: string, key: string): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM assets WHERE storage_bucket = $1 AND storage_key = $2",
      [bucket, key]
    );
  }

  async listByProject(projectId: UUID, kind?: string): Promise<unknown[]> {
    if (kind) {
      const { rows } = await this.pool.query(
        "SELECT * FROM assets WHERE project_id = $1 AND kind = $2 ORDER BY created_at DESC",
        [projectId, kind]
      );
      return rows;
    }
    const { rows } = await this.pool.query(
      "SELECT * FROM assets WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId]
    );
    return rows;
  }

  async linkToProject(projectId: UUID, assetId: UUID, meta: unknown): Promise<void> {
    const m = meta as Record<string, unknown>;
    await this.pool.query(
      `INSERT INTO project_assets (project_id, asset_id, role, label, origin, status, shot_index, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, asset_id) DO UPDATE SET role = EXCLUDED.role, metadata = EXCLUDED.metadata`,
      [
        projectId,
        assetId,
        m.role ?? "media",
        m.label ?? "",
        m.origin ?? "",
        m.status ?? "ready",
        m.shot_index ?? null,
        m.metadata ?? {},
      ]
    );
  }

  async linkToShot(projectId: UUID, shotIndex: number, assetId: UUID, role: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO shot_assets (project_id, shot_index, asset_id, role)
       VALUES ($1, $2, $3, $4)`,
      [projectId, shotIndex, assetId, role]
    );
  }
}

export class PgJobRepository implements IJobRepository {
  constructor(private readonly pool: IPgPool) {}

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO jobs (workspace_id, project_id, job_type, status, progress, message, input, workflow_run_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        i.workspace_id,
        i.project_id ?? null,
        i.job_type ?? "render_ffmpeg",
        i.status ?? "pending",
        i.progress ?? 0,
        i.message ?? "",
        i.input ?? i.payload ?? {},
        i.workflow_run_id ?? null,
      ]
    );
  }

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM jobs WHERE id = $1", [id]);
  }

  async updateStatus(id: UUID, patch: unknown): Promise<unknown> {
    const p = patch as Record<string, unknown>;
    return this.pool.queryOne(
      `UPDATE jobs SET
         status = COALESCE($2, status),
         progress = COALESCE($3, progress),
         message = COALESCE($4, message)
       WHERE id = $1 RETURNING *`,
      [id, p.status ?? null, p.progress ?? null, p.message ?? null]
    );
  }

  async appendStep(jobId: UUID, step: unknown): Promise<unknown> {
    const s = step as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO job_steps (job_id, step_index, name, status, message, payload, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        jobId,
        s.step_index ?? s.step_key ?? 0,
        s.name ?? s.step_key ?? "step",
        s.status ?? "done",
        s.message ?? "",
        s.payload ?? {},
        s.started_at ?? new Date(),
        s.finished_at ?? s.completed_at ?? null,
      ]
    );
  }

  async listByProject(projectId: UUID, params?: PageParams): Promise<PageResult<unknown>> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { rows } = await this.pool.query(
      `SELECT * FROM jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );
    const count = await this.pool.queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM jobs WHERE project_id = $1",
      [projectId]
    );
    return { items: rows, total: Number(count?.count ?? rows.length) };
  }
}
