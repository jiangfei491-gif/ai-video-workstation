import type { IPgPool } from "./pool";
import type {
  IMaterialRepository,
  ICharacterRepository,
  ISceneRepository,
  IPropRepository,
  PageParams,
  PageResult,
  UUID,
} from "../interfaces";

function paginate<T>(items: T[], params?: PageParams): PageResult<T> {
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 100;
  return { items: items.slice(offset, offset + limit), total: items.length };
}

export class PgMaterialRepository implements IMaterialRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM materials WHERE id = $1", [id]);
  }

  async listByWorkspace(workspaceId: UUID, params?: PageParams): Promise<PageResult<unknown>> {
    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;
    const { rows } = await this.pool.query(
      `SELECT * FROM materials WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset]
    );
    const count = await this.pool.queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM materials WHERE workspace_id = $1",
      [workspaceId]
    );
    return { items: rows, total: Number(count?.count ?? rows.length) };
  }

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO materials (workspace_id, title, content, source, url, category, language, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        i.workspace_id,
        i.title ?? "",
        i.content ?? "",
        i.source ?? "",
        i.url ?? "",
        i.category ?? "",
        i.language ?? "zh",
        i.status ?? "draft",
      ]
    );
  }

  async update(id: UUID, patch: unknown): Promise<unknown> {
    const p = patch as Record<string, unknown>;
    return this.pool.queryOne(
      `UPDATE materials SET
         title = COALESCE($2, title),
         content = COALESCE($3, content),
         status = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, p.title ?? null, p.content ?? null, p.status ?? null]
    );
  }
}

export class PgCharacterRepository implements ICharacterRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM characters WHERE id = $1", [id]);
  }

  async listByWorkspace(workspaceId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM characters WHERE workspace_id = $1 ORDER BY created_at DESC",
      [workspaceId]
    );
    return rows;
  }

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO characters (workspace_id, name, appearance, ref_asset_id, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [i.workspace_id, i.name ?? "", i.appearance ?? "", i.ref_asset_id ?? null, i.metadata ?? {}]
    );
  }
}

export class PgSceneRepository implements ISceneRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM scenes WHERE id = $1", [id]);
  }

  async listByWorkspace(workspaceId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM scenes WHERE workspace_id = $1 ORDER BY created_at DESC",
      [workspaceId]
    );
    return rows;
  }

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO scenes (workspace_id, name, description, ref_asset_id, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [i.workspace_id, i.name ?? "", i.description ?? "", i.ref_asset_id ?? null, i.metadata ?? {}]
    );
  }
}

export class PgPropRepository implements IPropRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM props WHERE id = $1", [id]);
  }

  async listByWorkspace(workspaceId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM props WHERE workspace_id = $1 ORDER BY created_at DESC",
      [workspaceId]
    );
    return rows;
  }

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO props (workspace_id, name, description, ref_asset_id, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [i.workspace_id, i.name ?? "", i.description ?? "", i.ref_asset_id ?? null, i.metadata ?? {}]
    );
  }
}

export { paginate };
