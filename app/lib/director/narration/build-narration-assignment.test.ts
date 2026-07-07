import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildNarrationAssignment } from "./build-narration-assignment";

/** 运行：npx tsx --test app/lib/director/narration/build-narration-assignment.test.ts */

const beat = (beatId: string, narration?: string) => ({ beatId, narration });
const shot = (shotId: string, beatId: string) => ({ shotId, beatId });
const narrated = (a: ReturnType<typeof buildNarrationAssignment>) =>
  Object.entries(a.shotNarrationText).filter(([, t]) => t.trim()).map(([id]) => id);

describe("NarrationAssignment (IMAGE Closure)", () => {
  it("A1–A4. 2 phrases / 5 shots → 前 2 镜有旁白，其余空", () => {
    const a = buildNarrationAssignment({
      beats: [beat("B1", "句一内容。句二内容。")],
      storyboard: ["s1", "s2", "s3", "s4", "s5"].map((s) => shot(s, "B1")),
    });
    assert.equal(a.shotNarrationText.s1, "句一内容。"); // phrase1 → Shot1
    assert.equal(a.shotNarrationText.s2, "句二内容。"); // phrase2 → Shot2
    assert.equal(a.shotNarrationText.s3, "");
    assert.equal(a.shotNarrationText.s4, "");
    assert.equal(a.shotNarrationText.s5, "");
    assert.deepEqual(narrated(a), ["s1", "s2"]);
  });

  it("A7. Beat isolation：跨 Beat 泄漏 = 0，各 Beat 旁白只在自己镜头", () => {
    const a = buildNarrationAssignment({
      beats: [beat("B1", "甲甲甲甲甲甲。"), beat("B2", "乙乙乙乙乙乙。")],
      storyboard: [shot("s1", "B1"), shot("s2", "B1"), shot("s3", "B2"), shot("s4", "B2")],
    });
    assert.equal(a.crossBeatLeakCount, 0);
    assert.ok(a.shotNarrationText.s1.includes("甲") && !a.shotNarrationText.s1.includes("乙"));
    assert.ok(a.shotNarrationText.s3.includes("乙") && !a.shotNarrationText.s3.includes("甲"));
  });

  it("A8. empty Beat narration → 该 Beat 全部镜头空（无 voice 输入）", () => {
    const a = buildNarrationAssignment({
      beats: [beat("B1", "")],
      storyboard: [shot("s1", "B1"), shot("s2", "B1")],
    });
    assert.equal(a.shotNarrationText.s1, "");
    assert.equal(a.shotNarrationText.s2, "");
    assert.deepEqual(narrated(a), []);
  });

  it("A9–A14. 旁白只来自 beat.narration（结构上不可能取 action/environment/narrationRef）", () => {
    // buildNarrationAssignment 输入只有 beatId/narration/shotId/beatId，无视觉字段 → 文本必属 beat.narration
    const a = buildNarrationAssignment({
      beats: [beat("B1", "唯一旁白句。")],
      storyboard: [shot("s1", "B1"), shot("s2", "B1")],
    });
    assert.equal(a.shotNarrationText.s1, "唯一旁白句。");
    assert.equal(a.shotNarrationText.s2, ""); // 不会拿 action/environment 补
    assert.ok(!a.shotNarrationText.s2.includes("BEAT")); // narrationRef 不入文本
  });

  it("A15. reorder：deterministic + shotId 定位（不跨 Beat）", () => {
    const beats = [beat("B1", "句一。句二。句三。")];
    const base = [shot("s1", "B1"), shot("s2", "B1"), shot("s3", "B1")];
    const a1 = buildNarrationAssignment({ beats, storyboard: base });
    assert.equal(a1.shotNarrationText.s1, "句一。");
    assert.equal(a1.crossBeatLeakCount, 0);
    // 同一 storyboard 顺序 → 完全相同结果（deterministic）
    const a1b = buildNarrationAssignment({ beats, storyboard: base });
    assert.deepEqual(a1b.shotNarrationText, a1.shotNarrationText);
    // 重排后仍是纯函数按位置分配、shotId 定位、不跨 Beat
    const reordered = buildNarrationAssignment({ beats, storyboard: [base[2], base[0], base[1]] });
    assert.equal(reordered.crossBeatLeakCount, 0);
    assert.equal(Object.keys(reordered.shotNarrationText).length, 3);
  });

  it("A16. delete：删镜后剩余镜头旁白仍在本 Beat 内、无串位", () => {
    const beats = [beat("B1", "句一。句二。")];
    const a = buildNarrationAssignment({ beats, storyboard: [shot("s2", "B1"), shot("s3", "B1")] });
    assert.equal(a.crossBeatLeakCount, 0);
    assert.equal(a.shotNarrationText.s2, "句一。");
    assert.equal(a.shotNarrationText.s3, "句二。");
  });

  it("A17. insert：插镜后不跨 Beat、不串位", () => {
    const beats = [beat("B1", "句一。"), beat("B2", "句二。")];
    const a = buildNarrationAssignment({
      beats,
      storyboard: [shot("s1", "B1"), shot("sNew", "B1"), shot("s2", "B2")],
    });
    assert.equal(a.crossBeatLeakCount, 0);
    assert.equal(a.shotNarrationText.s1, "句一。");
    assert.equal(a.shotNarrationText.sNew, ""); // B1 只有 1 句，第二镜空
    assert.equal(a.shotNarrationText.s2, "句二。"); // B2 的句不会泄漏给 B1
  });

  it("phrases > shots：句多于镜时每镜取相邻多句（不丢句）", () => {
    const a = buildNarrationAssignment({
      beats: [beat("B1", "一。二。三。四。")],
      storyboard: [shot("s1", "B1"), shot("s2", "B1")],
    });
    // 4 句 2 镜 → quota 2，s1 取前 2、s2 取后 2
    assert.equal(a.shotNarrationText.s1, "一。二。");
    assert.equal(a.shotNarrationText.s2, "三。四。");
  });
});
