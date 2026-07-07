import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  resetDatabaseInfraConfig,
  loadDatabaseInfraConfig,
} from "../config";
import {
  createRepositoryBundle,
  resetRepositoryBundleCache,
  resolveRepositoryMode,
} from "../repositories/factory";
import { CORE_REPOSITORY_NAMES } from "../repositories/index";

describe("Repository", () => {
  beforeEach(() => {
    resetDatabaseInfraConfig();
    resetRepositoryBundleCache();
    delete process.env.AI_CUT_DUAL_WRITE;
    delete process.env.REPOSITORY_MODE;
  });

  it("默认 PostgreSQL 模式", () => {
    assert.equal(resolveRepositoryMode(), "postgres");
    const bundle = createRepositoryBundle();
    assert.equal(Object.keys(bundle).length, 36);
    for (const name of CORE_REPOSITORY_NAMES) {
      assert.ok(name in bundle, `missing ${name}`);
    }
  });

  it("双写默认关闭", () => {
    const cfg = loadDatabaseInfraConfig();
    assert.equal(cfg.dualWriteEnabled, false);
    assert.equal(cfg.readSource, "postgres");
  });

  it("PostgreSQL Material 可读", async () => {
    const bundle = createRepositoryBundle();
    const result = await bundle.material.listByWorkspace(
      "00000000-0000-4000-8000-000000000010"
    );
    assert.ok(typeof result.total === "number");
  });
});
