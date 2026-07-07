/**
 * Migration Framework — 类型定义
 */

export type MigrationDomain =
  | "workspace"
  | "project"
  | "asset"
  | "material"
  | "character"
  | "scene"
  | "prop"
  | "director"
  | "timeline"
  | "voice"
  | "subtitle"
  | "music"
  | "effect"
  | "job"
  | "qa"
  | "export"
  | "cost"
  | "logs";

export type MigrationPhase = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

export interface MigrationPlanItem {
  domain: MigrationDomain;
  source: string;
  targetTable: string;
  estimatedCount: number;
  notes?: string;
}

export interface MigrationPlan {
  phase: MigrationPhase;
  batchId: string;
  items: MigrationPlanItem[];
  dryRun: boolean;
  execute: boolean;
}

export interface MigrationResult {
  domain: MigrationDomain;
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
  dryRun: boolean;
}

export interface MigrationBatchResult {
  batchId: string;
  phase: MigrationPhase;
  results: MigrationResult[];
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  executed: boolean;
}

export interface ConsistencyIssue {
  domain: MigrationDomain;
  severity: "error" | "warning";
  message: string;
  legacyKey?: string;
  postgresId?: string;
}

export interface ConsistencyReport {
  ok: boolean;
  checkedAt: string;
  issues: ConsistencyIssue[];
  summary: Record<string, { legacy: number; postgres: number }>;
}

export interface RollbackSnapshot {
  id: string;
  batchId: string;
  phase: MigrationPhase;
  createdAt: string;
  path: string;
  domains: MigrationDomain[];
}

export interface IMigrator {
  readonly domain: MigrationDomain;
  readonly phase: MigrationPhase;
  readonly jsonFile?: string;
  readonly targetTable?: string;
  plan(): Promise<MigrationPlanItem[]>;
  migrate(options: { dryRun: boolean; execute: boolean }): Promise<MigrationResult>;
  validate(): Promise<ConsistencyIssue[]>;
}

export interface MigrationRunnerOptions {
  phase: MigrationPhase;
  dryRun?: boolean;
  execute?: boolean;
  domains?: MigrationDomain[];
}
