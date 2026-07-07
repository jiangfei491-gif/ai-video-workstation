import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runConsistencyCheck } from "../migrations/framework";

describe("Consistency Check", () => {
  it("可运行一致性校验", async () => {
    const report = await runConsistencyCheck({
      domains: ["material", "character"],
    });
    assert.ok(report.checkedAt);
    assert.ok("material" in report.summary);
    assert.ok("character" in report.summary);
    assert.ok(typeof report.ok === "boolean");
  });
});
