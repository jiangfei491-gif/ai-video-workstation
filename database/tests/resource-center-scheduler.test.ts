import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import {
  computeNextRunAt,
  mergeGlobalConfig,
  sortSourcesByStrategy,
} from "../../app/lib/resource-center/phase2/scheduler/cron-utils";
import { DEFAULT_SCHEDULER_CONFIG } from "../../app/lib/resource-center/phase2/scheduler/types";
import { DEFAULT_WORKSPACE_ID } from "../migrations/unification/constants";
import { ensureDefaultIdentity } from "../migrations/unification/bootstrap-db";
import { createPgPool } from "../repositories/pg/pool";
import {
  createResourceCenterSchedulerRepos,
  resetResourceCenterReposCache,
} from "../repositories/resource-center";

describe("Crawler Scheduler", () => {
  afterEach(() => {
    resetResourceCenterReposCache();
  });

  it("默认配置", () => {
    assert.equal(DEFAULT_SCHEDULER_CONFIG.autoCrawlEnabled, true);
    assert.deepEqual(DEFAULT_SCHEDULER_CONFIG.defaultCrawlTimes, ["02:00"]);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.defaultScanMode, "new_only");
    assert.equal(DEFAULT_SCHEDULER_CONFIG.defaultMaxItemsPerSite, 100);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.downloadConcurrency, 5);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.analysisConcurrency, 3);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.failureRetries, 3);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.crawlTimeoutSec, 300);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.logRetentionDays, 90);
    assert.equal(DEFAULT_SCHEDULER_CONFIG.autoImport, false);
  });

  it("computeNextRunAt 每日调度", () => {
    const from = new Date("2026-06-29T10:00:00Z");
    const next = computeNextRunAt({ frequency: "daily", customCron: "", crawlTimes: ["02:00"] }, from);
    assert.ok(next);
    assert.ok(next! > from);
  });

  it("优先级轮询排序", () => {
    const sorted = sortSourcesByStrategy(
      [
        { id: "a", priority: "low" as const },
        { id: "b", priority: "high" as const },
        { id: "c", priority: "medium" as const },
      ],
      "priority"
    );
    assert.equal(sorted[0]!.id, "b");
  });

  it("mergeGlobalConfig", () => {
    const merged = mergeGlobalConfig({ downloadConcurrency: 8 });
    assert.equal(merged.downloadConcurrency, 8);
    assert.equal(merged.analysisConcurrency, 3);
  });

  it("Scheduler DB（需 PostgreSQL）", async () => {
    const pool = createPgPool();
    try {
      await ensureDefaultIdentity(pool);
      resetResourceCenterReposCache();
      const repos = createResourceCenterSchedulerRepos(pool);
      const cfg = await repos.scheduler.upsertConfig(DEFAULT_WORKSPACE_ID, DEFAULT_SCHEDULER_CONFIG);
      assert.ok(cfg.id);
      const read = await repos.scheduler.getConfig(DEFAULT_WORKSPACE_ID);
      assert.equal(read?.config.downloadConcurrency, 5);
    } finally {
      await pool.end();
    }
  });
});
