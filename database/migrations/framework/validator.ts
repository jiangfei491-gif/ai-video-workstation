import { readJsonArray } from "../../repositories/shared/json-store";
import { createPgPool } from "../../repositories/pg/pool";
import type { ConsistencyIssue, ConsistencyReport, MigrationDomain } from "./types";

const DOMAIN_JSON_FILES: Partial<Record<MigrationDomain, string>> = {
  material: "materials.json",
  character: "characters.json",
  scene: "scenes.json",
  prop: "props.json",
  asset: "image-assets.json",
  job: "auto-edit-jobs.json",
};

const DOMAIN_PG_TABLES: Partial<Record<MigrationDomain, string>> = {
  material: "materials",
  character: "characters",
  scene: "scenes",
  prop: "props",
  asset: "assets",
  job: "jobs",
  project: "projects",
  director: "project_director_state",
  timeline: "timelines",
  qa: "qa_reports",
  export: "export_records",
  cost: "cost_ledger",
  logs: "activity_logs",
};

export async function checkDomainConsistency(
  domain: MigrationDomain,
  databaseUrl?: string
): Promise<{ legacy: number; postgres: number; issues: ConsistencyIssue[] }> {
  const issues: ConsistencyIssue[] = [];
  const jsonFile = DOMAIN_JSON_FILES[domain];
  const table = DOMAIN_PG_TABLES[domain];

  let legacyCount = 0;
  if (jsonFile) {
    legacyCount = readJsonArray(jsonFile).length;
  } else if (domain === "project") {
    issues.push({
      domain,
      severity: "warning",
      message: "Project 数据在 workbench localStorage，需导出 JSON 后迁移",
    });
  }

  let postgresCount = 0;
  if (table) {
    try {
      const pool = createPgPool({ connectionString: databaseUrl });
      const row = await pool.queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${table}`
      );
      postgresCount = Number(row?.count ?? 0);
      await pool.end();
    } catch (err) {
      issues.push({
        domain,
        severity: "error",
        message: `PostgreSQL 查询失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (jsonFile && table && legacyCount !== postgresCount) {
    issues.push({
      domain,
      severity: "warning",
      message: `数量不一致: Legacy=${legacyCount}, PostgreSQL=${postgresCount}`,
    });
  }

  return { legacy: legacyCount, postgres: postgresCount, issues };
}

export async function runConsistencyCheck(options?: {
  domains?: MigrationDomain[];
  databaseUrl?: string;
}): Promise<ConsistencyReport> {
  const domains: MigrationDomain[] =
    options?.domains ??
    ([
      "material",
      "character",
      "scene",
      "prop",
      "asset",
      "job",
      "project",
      "director",
      "timeline",
      "cost",
      "logs",
    ] as MigrationDomain[]);

  const issues: ConsistencyIssue[] = [];
  const summary: Record<string, { legacy: number; postgres: number }> = {};

  for (const domain of domains) {
    const result = await checkDomainConsistency(domain, options?.databaseUrl);
    summary[domain] = { legacy: result.legacy, postgres: result.postgres };
    issues.push(...result.issues);
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    checkedAt: new Date().toISOString(),
    issues,
    summary,
  };
}
