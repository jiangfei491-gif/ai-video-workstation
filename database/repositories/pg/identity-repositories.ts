import type { IPgPool } from "./pool";
import type { IUserRepository, IWorkspaceRepository, UUID } from "../interfaces";

export class PgUserRepository implements IUserRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM users WHERE id = $1", [id]);
  }

  async findByEmail(email: string): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM users WHERE email = $1", [email]);
  }
}

export class PgWorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM workspaces WHERE id = $1", [id]);
  }

  async findBySlug(slug: string): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM workspaces WHERE slug = $1", [slug]);
  }

  async listMembers(workspaceId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM workspace_members WHERE workspace_id = $1",
      [workspaceId]
    );
    return rows;
  }
}
