import { getDatabaseInfraConfig } from "../../config";
import { readJsonArray } from "../../repositories/shared/json-store";
import type {
  IMigrator,
  MigrationBatchResult,
  MigrationDomain,
  MigrationPhase,
  MigrationPlan,
  MigrationPlanItem,
  MigrationResult,
  MigrationRunnerOptions,
} from "./types";
import { createPreMigrationSnapshot } from "./rollback";
import { recordBatchResult } from "./rollback";

abstract class BaseMigrator implements IMigrator {
  abstract readonly domain: MigrationDomain;
  abstract readonly phase: MigrationPhase;
  abstract readonly jsonFile?: string;
  abstract readonly targetTable: string;

  async plan(): Promise<MigrationPlanItem[]> {
    const count = this.jsonFile ? readJsonArray(this.jsonFile).length : 0;
    return [
      {
        domain: this.domain,
        source: this.jsonFile ?? "workbench-export",
        targetTable: this.targetTable,
        estimatedCount: count,
      },
    ];
  }

  async migrate(options: {
    dryRun: boolean;
    execute: boolean;
  }): Promise<MigrationResult> {
    const items = await this.plan();
    const count = items[0]?.estimatedCount ?? 0;
    const cfg = getDatabaseInfraConfig();

    if (!options.execute || !cfg.migrationExecute) {
      return {
        domain: this.domain,
        success: true,
        migrated: 0,
        skipped: count,
        errors: [],
        dryRun: true,
      };
    }

    return {
      domain: this.domain,
      success: false,
      migrated: 0,
      skipped: count,
      errors: ["迁移执行需显式 AI_CUT_MIGRATION_EXECUTE=true — P2 默认禁止"],
      dryRun: false,
    };
  }

  async validate() {
    const { checkDomainConsistency } = await import("./validator");
    const r = await checkDomainConsistency(this.domain);
    return r.issues;
  }
}

export class MaterialMigrator extends BaseMigrator {
  readonly domain = "material" as const;
  readonly phase = "D2" as const;
  readonly jsonFile = "materials.json";
  readonly targetTable = "materials";
}

export class CharacterMigrator extends BaseMigrator {
  readonly domain = "character" as const;
  readonly phase = "D2" as const;
  readonly jsonFile = "characters.json";
  readonly targetTable = "characters";
}

export class SceneMigrator extends BaseMigrator {
  readonly domain = "scene" as const;
  readonly phase = "D2" as const;
  readonly jsonFile = "scenes.json";
  readonly targetTable = "scenes";
}

export class PropMigrator extends BaseMigrator {
  readonly domain = "prop" as const;
  readonly phase = "D2" as const;
  readonly jsonFile = "props.json";
  readonly targetTable = "props";
}

export class AssetMigrator extends BaseMigrator {
  readonly domain = "asset" as const;
  readonly phase = "D3" as const;
  readonly jsonFile = "image-assets.json";
  readonly targetTable = "assets";
}

export class JobMigrator extends BaseMigrator {
  readonly domain = "job" as const;
  readonly phase = "D6" as const;
  readonly jsonFile = "auto-edit-jobs.json";
  readonly targetTable = "jobs";
}

export class ProjectMigrator extends BaseMigrator {
  readonly domain = "project" as const;
  readonly phase = "D4" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "projects";
}

export class DirectorMigrator extends BaseMigrator {
  readonly domain = "director" as const;
  readonly phase = "D5" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "project_director_state";
}

export class TimelineMigrator extends BaseMigrator {
  readonly domain = "timeline" as const;
  readonly phase = "D5" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "timelines";
}

export class VoiceMigrator extends BaseMigrator {
  readonly domain = "voice" as const;
  readonly phase = "D5" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "center_states";
}

export class SubtitleMigrator extends BaseMigrator {
  readonly domain = "subtitle" as const;
  readonly phase = "D5" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "center_states";
}

export class MusicMigrator extends BaseMigrator {
  readonly domain = "music" as const;
  readonly phase = "D5" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "music_library";
}

export class EffectMigrator extends BaseMigrator {
  readonly domain = "effect" as const;
  readonly phase = "D5" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "effects_library";
}

export class QaMigrator extends BaseMigrator {
  readonly domain = "qa" as const;
  readonly phase = "D6" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "qa_reports";
}

export class ExportMigrator extends BaseMigrator {
  readonly domain = "export" as const;
  readonly phase = "D6" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "export_records";
}

export class CostMigrator extends BaseMigrator {
  readonly domain = "cost" as const;
  readonly phase = "D6" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "cost_ledger";
}

export class LogsMigrator extends BaseMigrator {
  readonly domain = "logs" as const;
  readonly phase = "D6" as const;
  readonly jsonFile = undefined;
  readonly targetTable = "activity_logs";
}

export function getAllMigrators(): IMigrator[] {
  return [
    new MaterialMigrator(),
    new CharacterMigrator(),
    new SceneMigrator(),
    new PropMigrator(),
    new AssetMigrator(),
    new JobMigrator(),
    new ProjectMigrator(),
    new DirectorMigrator(),
    new TimelineMigrator(),
    new VoiceMigrator(),
    new SubtitleMigrator(),
    new MusicMigrator(),
    new EffectMigrator(),
    new QaMigrator(),
    new ExportMigrator(),
    new CostMigrator(),
    new LogsMigrator(),
  ];
}

export function getMigratorsForPhase(phase: MigrationPhase): IMigrator[] {
  return getAllMigrators().filter((m) => m.phase === phase);
}

export async function buildMigrationPlan(
  options: MigrationRunnerOptions
): Promise<MigrationPlan> {
  const migrators = options.domains
    ? getAllMigrators().filter((m) => options.domains!.includes(m.domain))
    : getMigratorsForPhase(options.phase);

  const items: MigrationPlanItem[] = [];
  for (const m of migrators) {
    items.push(...(await m.plan()));
  }

  const cfg = getDatabaseInfraConfig();
  return {
    phase: options.phase,
    batchId: `${options.phase}-${Date.now()}`,
    items,
    dryRun: options.dryRun !== false,
    execute: Boolean(options.execute && cfg.migrationExecute),
  };
}

export async function runMigrationBatch(
  options: MigrationRunnerOptions
): Promise<MigrationBatchResult> {
  const plan = await buildMigrationPlan(options);
  const cfg = getDatabaseInfraConfig();
  const dryRun = !options.execute || !cfg.migrationExecute;
  const execute = Boolean(options.execute && cfg.migrationExecute);

  const migrators = options.domains
    ? getAllMigrators().filter((m) => options.domains!.includes(m.domain))
    : getMigratorsForPhase(options.phase);

  // 预迁移快照（Legacy JSON）
  const legacyFiles: Record<string, unknown> = {};
  for (const m of migrators) {
    if (m.jsonFile) {
      legacyFiles[m.jsonFile] = readJsonArray(m.jsonFile);
    }
  }
  if (Object.keys(legacyFiles).length > 0) {
    createPreMigrationSnapshot(
      plan.batchId,
      options.phase,
      migrators.map((m) => m.domain),
      legacyFiles
    );
  }

  const startedAt = new Date().toISOString();
  const results: MigrationResult[] = [];

  for (const m of migrators) {
    results.push(await m.migrate({ dryRun, execute }));
  }

  const batch: MigrationBatchResult = {
    batchId: plan.batchId,
    phase: options.phase,
    results,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun,
    executed: execute,
  };

  recordBatchResult(batch);
  return batch;
}
