import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  estimateNarrationDurationSec,
  NARRATION_RATE,
} from "./estimate-narration-duration";

/** 运行：npx tsx --test app/lib/director/duration/estimate-narration-duration.test.ts */

describe("Narration Duration Estimator (Phase 2A)", () => {
  it("A. 空文本 → 0", () => {
    assert.equal(estimateNarrationDurationSec("").durationSec, 0);
    assert.equal(estimateNarrationDurationSec("   \n ").durationSec, 0);
    assert.equal(estimateNarrationDurationSec("").languageMode, "empty");
  });

  it("B. 中文 deterministic（字数 / 5.5）", () => {
    const r = estimateNarrationDurationSec("旁".repeat(11));
    assert.equal(r.languageMode, "cjk");
    assert.equal(r.textUnitCount, 11);
    assert.ok(Math.abs(r.durationSec - 11 / NARRATION_RATE.cjkCharsPerSec) < 1e-3, `${r.durationSec}`);
  });

  it("C. 英文 deterministic（词数 / 150wpm）", () => {
    const r = estimateNarrationDurationSec("hello world foo bar");
    assert.equal(r.languageMode, "latin");
    assert.equal(r.textUnitCount, 4);
    assert.ok(Math.abs(r.durationSec - 4 / (NARRATION_RATE.latinWordsPerMin / 60)) < 1e-3, `${r.durationSec}`);
  });

  it("D. 中英混排 → 分别估算相加", () => {
    const r = estimateNarrationDurationSec("hello 旁旁旁旁旁");
    assert.equal(r.languageMode, "mixed");
    const expect = 5 / NARRATION_RATE.cjkCharsPerSec + 1 / (NARRATION_RATE.latinWordsPerMin / 60);
    assert.ok(Math.abs(r.durationSec - expect) < 1e-3, `${r.durationSec} vs ${expect}`);
  });

  it("E. 标点/空白不造成膨胀", () => {
    const plain = estimateNarrationDurationSec("旁旁旁");
    const noisy = estimateNarrationDurationSec("旁，旁。旁！   \n\n …");
    assert.equal(plain.durationSec, noisy.durationSec);
    assert.equal(noisy.textUnitCount, 3);
  });

  it("F. 更长旁白 → 更长时长", () => {
    const short = estimateNarrationDurationSec("旁".repeat(10)).durationSec;
    const long = estimateNarrationDurationSec("旁".repeat(50)).durationSec;
    assert.ok(long > short);
  });

  it("G. 同输入 → 完全相同估算（deterministic）", () => {
    const a = estimateNarrationDurationSec("苹果不可能存在 hello 2024");
    const b = estimateNarrationDurationSec("苹果不可能存在 hello 2024");
    assert.deepEqual(a, b);
  });
});
