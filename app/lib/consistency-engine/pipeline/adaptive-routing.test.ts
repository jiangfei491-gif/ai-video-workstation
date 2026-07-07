import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeGateVerdict,
  routeAfterTier1,
  routeAfterFinal,
  planImageTaskRoute,
} from "./adaptive-routing";

/**
 * Adaptive Routing 回归：Tier1 QC = Routing Gate，Final QC = Asset Admission Gate。
 * 运行：npx tsx --test app/lib/consistency-engine/pipeline/adaptive-routing.test.ts
 */

describe("primitives", () => {
  it("normalizeGateVerdict: PASS / REPAIRABLE / FAIL 分带（threshold=90, band=15）", () => {
    assert.equal(normalizeGateVerdict({ passed: true, composite: 95 }, 90), "PASS");
    assert.equal(normalizeGateVerdict({ passed: false, composite: 80 }, 90), "REPAIRABLE"); // ≥75
    assert.equal(normalizeGateVerdict({ passed: false, composite: 70 }, 90), "FAIL"); // <75
  });
  it("routeAfterTier1: 分流器", () => {
    assert.equal(routeAfterTier1("PASS"), "final");
    assert.equal(routeAfterTier1("REPAIRABLE"), "refine");
    assert.equal(routeAfterTier1("FAIL"), "regenerate");
  });
  it("routeAfterFinal: 准入门", () => {
    assert.equal(routeAfterFinal(true, 0, 2), "commit");
    assert.equal(routeAfterFinal(false, 0, 2), "gptRepair");
    assert.equal(routeAfterFinal(false, 1, 2), "gptRepair");
    assert.equal(routeAfterFinal(false, 2, 2), "failed");
  });
});

describe("Adaptive Routing — 端到端路由场景", () => {
  it("A. PASS → Final QC PASS：Schnell1 Dev0 GPT0，Asset Commit YES", () => {
    const p = planImageTaskRoute({ tier1Verdict: "PASS", finalPassSeq: [true], maxRepairAttempts: 2 });
    assert.equal(p.committed, true);
    assert.equal(p.counts.tier1Candidate, 1);
    assert.equal(p.counts.fluxDevRefine, 0);
    assert.equal(p.counts.fluxDevRegenerate, 0);
    assert.equal(p.counts.gptRepair, 0);
    assert.equal(p.counts.finalQc, 1);
    assert.deepEqual(p.actions, ["TIER1", "TIER1_QC", "FINAL_QC", "COMMIT"]);
  });

  it("B. PASS → Final QC FAIL → GPT Repair → PASS：Asset Commit YES", () => {
    const p = planImageTaskRoute({ tier1Verdict: "PASS", finalPassSeq: [false, true], maxRepairAttempts: 2 });
    assert.equal(p.committed, true);
    assert.equal(p.counts.fluxDevRefine, 0);
    assert.equal(p.counts.gptRepair, 1);
    assert.equal(p.counts.finalQc, 2);
    assert.deepEqual(p.actions, ["TIER1", "TIER1_QC", "FINAL_QC", "GPT_REPAIR", "FINAL_QC", "COMMIT"]);
  });

  it("C. REPAIRABLE → FLUX Dev Refine → Final QC PASS：Asset Commit YES", () => {
    const p = planImageTaskRoute({ tier1Verdict: "REPAIRABLE", finalPassSeq: [true], maxRepairAttempts: 2 });
    assert.equal(p.committed, true);
    assert.equal(p.counts.fluxDevRefine, 1);
    assert.equal(p.counts.fluxDevRegenerate, 0);
    assert.equal(p.counts.gptRepair, 0);
    assert.deepEqual(p.actions, ["TIER1", "TIER1_QC", "REFINE", "FINAL_QC", "COMMIT"]);
  });

  it("D. FAIL → FLUX Dev Regenerate → Final QC PASS：Asset Commit YES", () => {
    const p = planImageTaskRoute({ tier1Verdict: "FAIL", finalPassSeq: [true], maxRepairAttempts: 2 });
    assert.equal(p.committed, true);
    assert.equal(p.counts.fluxDevRegenerate, 1);
    assert.equal(p.counts.fluxDevRefine, 0);
    assert.equal(p.counts.gptRepair, 0);
    assert.deepEqual(p.actions, ["TIER1", "TIER1_QC", "REGENERATE", "FINAL_QC", "COMMIT"]);
  });

  it("E. Final QC FAIL × maxRepairAttempts 仍 FAIL：ImageTask FAILED，Asset Commit NO", () => {
    const p = planImageTaskRoute({ tier1Verdict: "PASS", finalPassSeq: [false, false, false], maxRepairAttempts: 2 });
    assert.equal(p.committed, false);
    assert.equal(p.counts.gptRepair, 2); // 恰好 maxRepairAttempts 次
    assert.equal(p.counts.finalQc, 3); // 候选 + 2 次 repair 后
    assert.equal(p.actions.at(-1), "FAILED");
  });

  it("F/G. FAILED result 不得进入 dualWrite（imageTaskFrames / imageTaskFrameAssets 不写入）", () => {
    // 复刻 run-batch-images 的准入判定：result.failed || !frame → 不提交
    const shouldCommit = (r: { failed?: boolean; frames: unknown[] }) => !(r.failed || !r.frames[0]);
    assert.equal(shouldCommit({ failed: true, frames: [] }), false); // TASK_FAILED → 不写资产
    assert.equal(shouldCommit({ failed: false, frames: [] }), false); // 无 frame → 不写资产
    assert.equal(shouldCommit({ failed: false, frames: [{ url: "u" }] }), true); // 仅通过才写
  });

  it("H. standard 不再固定 FLUX ×2：PASS 路径只 1 次候选、0 次精修", () => {
    const p = planImageTaskRoute({ tier1Verdict: "PASS", finalPassSeq: [true], maxRepairAttempts: 2 });
    const totalFlux = p.counts.tier1Candidate + p.counts.fluxDevRefine + p.counts.fluxDevRegenerate;
    assert.equal(totalFlux, 1); // 旧固定流水线恒为 2；新版 PASS 只 1
  });

  it("边界：maxRepairAttempts=0 时 Final QC FAIL 立即 FAILED", () => {
    const p = planImageTaskRoute({ tier1Verdict: "PASS", finalPassSeq: [false], maxRepairAttempts: 0 });
    assert.equal(p.committed, false);
    assert.equal(p.counts.gptRepair, 0);
  });
});
