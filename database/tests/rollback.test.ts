import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPreMigrationSnapshot,
  listRollbackSnapshots,
  rollbackFromSnapshot,
} from "../migrations/framework/rollback";

describe("Rollback", () => {
  it("可创建快照并 dry-run 回滚", () => {
    const snap = createPreMigrationSnapshot(
      "test-batch",
      "D2",
      ["material"],
      { "materials.json": [] }
    );
    assert.ok(snap.id);
    assert.ok(snap.path);

    const listed = listRollbackSnapshots();
    assert.ok(listed.some((s) => s.id === snap.id));

    const result = rollbackFromSnapshot(snap.id, { dryRun: true });
    assert.equal(result.success, true);
    assert.ok(result.message.includes("dry-run"));
  });
});
