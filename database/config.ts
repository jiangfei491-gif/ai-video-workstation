/**
 * AI Video OS — 基础设施全局配置
 */

import { resolveInitialWorkspaceRoot } from "./workspace";

export type RepositoryReadSource = "postgres";

export interface DatabaseInfraConfig {
  /** 固定 postgres — Workspace 唯一 SoT */
  repositoryMode: "postgres";
  dualWriteEnabled: boolean;
  readSource: RepositoryReadSource;
  migrationExecute: boolean;
  databaseUrl: string;
  storageProvider: "local" | "minio" | "s3" | "gcs" | "azure";
  storageLocalRoot: string;
  storageDefaultBucket: string;
  redisEnabled: boolean;
  redisUrl?: string;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const v = process.env[key]?.toLowerCase();
  if (v === undefined || v === "") return defaultValue;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

export function loadDatabaseInfraConfig(
  overrides: Partial<DatabaseInfraConfig> = {}
): DatabaseInfraConfig {
  return {
    repositoryMode: "postgres",
    dualWriteEnabled: false,
    readSource: "postgres",
    migrationExecute: envBool("AI_CUT_MIGRATION_EXECUTE", false),
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1",
    storageProvider:
      (process.env.STORAGE_PROVIDER as DatabaseInfraConfig["storageProvider"]) ??
      "local",
    storageLocalRoot: process.env.STORAGE_LOCAL_ROOT ?? resolveInitialWorkspaceRoot(),
    storageDefaultBucket: process.env.STORAGE_DEFAULT_BUCKET ?? "ai-cut",
    redisEnabled: envBool("REDIS_ENABLED", false),
    redisUrl: process.env.REDIS_URL,
    ...overrides,
  };
}

let runtimeConfig: DatabaseInfraConfig | null = null;

export function getDatabaseInfraConfig(): DatabaseInfraConfig {
  if (!runtimeConfig) runtimeConfig = loadDatabaseInfraConfig();
  return runtimeConfig;
}

export function setDatabaseInfraConfig(config: DatabaseInfraConfig): void {
  runtimeConfig = config;
}

export function resetDatabaseInfraConfig(): void {
  runtimeConfig = null;
}
