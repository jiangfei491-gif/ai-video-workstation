import { Pool, type PoolConfig, type QueryResultRow } from "pg";

export interface PgPoolConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMs?: number;
}

export interface IPgPool {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }>;
  queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null>;
  end(): Promise<void>;
}

export class PgPool implements IPgPool {
  private readonly pool: Pool;

  constructor(config: PgPoolConfig) {
    const poolConfig: PoolConfig = {
      connectionString: config.connectionString,
      max: config.max ?? 10,
      idleTimeoutMillis: config.idleTimeoutMs ?? 30_000,
    };
    this.pool = new Pool(poolConfig);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.pool.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const { rows } = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

let defaultPool: PgPool | null = null;

export function getDefaultDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1"
  );
}

export function createPgPool(config?: Partial<PgPoolConfig>): IPgPool {
  return new PgPool({
    connectionString: config?.connectionString ?? getDefaultDatabaseUrl(),
    max: config?.max,
    idleTimeoutMs: config?.idleTimeoutMs,
  });
}

export function getOrCreateDefaultPool(): IPgPool {
  if (!defaultPool) {
    defaultPool = new PgPool({ connectionString: getDefaultDatabaseUrl() });
  }
  return defaultPool;
}

export async function closeDefaultPool(): Promise<void> {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
}
