import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { resetDatabaseInfraConfig } from "../config";
import {
  buildMigrationPlan,
  getAllMigrators,
  runMigrationBatch,
} from "../migrations/framework";

describe("Migration Framework", () => {
  beforeEach(() => {
    resetDatabaseInfraConfig();
    delete process.env.AI_CUT_MIGRATION_EXECUTE;
  });

  it("包含全部域 Migrator", () => {
    const migrators = getAllMigrators();
    const domains = migrators.map((m) => m.domain);
    assert.ok(domains.includes("project"));
    assert.ok(domains.includes("material"));
    assert.ok(domains.includes("asset"));
    assert.ok(domains.includes("director"));
    assert.ok(domains.includes("timeline"));
    assert.ok(domains.includes("voice"));
    assert.ok(domains.includes("logs"));
    assert.ok(migrators.length >= 17);
  });

  it("默认 dry-run 不执行", async () => {
    const batch = await runMigrationBatch({ phase: "D2" });
    assert.equal(batch.dryRun, true);
    assert.equal(batch.executed, false);
    for (const r of batch.results) {
      assert.equal(r.dryRun, true);
      assert.equal(r.migrated, 0);
    }
  });

  it("可生成迁移计划", async () => {
    const plan = await buildMigrationPlan({ phase: "D2" });
    assert.equal(plan.phase, "D2");
    assert.ok(plan.items.length > 0);
    assert.equal(plan.execute, false);
  });
});
