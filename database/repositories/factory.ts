/**
 * AI Video OS — Repository 工厂
 *
 * 固定 PostgreSQL，Workspace 唯一 SoT。无 Legacy 回退。
 *
 * 环境变量：
 *   DATABASE_URL=...
 */

import { getDatabaseInfraConfig, loadDatabaseInfraConfig } from "../config";
import type { RepositoryBundle } from "./interfaces";
import { createPostgresRepositoryBundle } from "./pg/create-bundle";
import {
  closeDefaultPool,
  createPgPool,
  getDefaultDatabaseUrl,
  getOrCreateDefaultPool,
  type IPgPool,
} from "./pg/pool";

export type RepositoryMode = "postgres";

export interface RepositoryFactoryOptions {
  mode?: RepositoryMode;
  databaseUrl?: string;
  pool?: IPgPool;
}

let cachedBundle: RepositoryBundle | null = null;
let cacheKey: string | null = null;

function buildCacheKey(options: RepositoryFactoryOptions): string {
  return JSON.stringify({
    url: options.databaseUrl ?? "",
    hasPool: Boolean(options.pool),
  });
}

export function resolveRepositoryMode(_options?: RepositoryFactoryOptions): RepositoryMode {
  return "postgres";
}

export function createRepositoryBundle(options: RepositoryFactoryOptions = {}): RepositoryBundle {
  const key = buildCacheKey(options);

  if (cachedBundle && cacheKey === key && !options.pool && !options.databaseUrl) {
    return cachedBundle;
  }

  const pool =
    options.pool ??
    createPgPool({
      connectionString: options.databaseUrl ?? getDefaultDatabaseUrl(),
    });
  const bundle = createPostgresRepositoryBundle(pool);

  if (!options.pool && !options.databaseUrl) {
    cachedBundle = bundle;
    cacheKey = key;
  }

  return bundle;
}

export function getRepositoryBundle(): RepositoryBundle {
  return createRepositoryBundle();
}

export function resetRepositoryBundleCache(): void {
  cachedBundle = null;
  cacheKey = null;
}

export async function checkRepositoryConnectivity(
  options: RepositoryFactoryOptions = {}
): Promise<{
  mode: RepositoryMode;
  dualWrite: boolean;
  readSource: string;
  postgres: boolean;
  message: string;
}> {
  try {
    const pool = options.pool ?? getOrCreateDefaultPool();
    await pool.query("SELECT 1");
    return {
      mode: "postgres",
      dualWrite: false,
      readSource: "postgres",
      postgres: true,
      message: "PostgreSQL Repository 可连接",
    };
  } catch (err) {
    return {
      mode: "postgres",
      dualWrite: false,
      readSource: "postgres",
      postgres: false,
      message: `PostgreSQL 连接失败 — ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function shutdownRepositories(): Promise<void> {
  resetRepositoryBundleCache();
  await closeDefaultPool();
}

export { getDefaultDatabaseUrl, createPgPool, loadDatabaseInfraConfig, type IPgPool };
