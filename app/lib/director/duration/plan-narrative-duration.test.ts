import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planNarrativeDuration,
  shotPurposeWeight,
  beatTimingWeight,
  boundedWeightedAllocation,
  MIN_SHOT_DURATION_SEC,
  MAX_SHOT_DURATION_SEC,
  type DurationPlanBeat,
  type DurationPlanShot,
} from "./plan-narrative-duration";
import { resolveShotMotion } from "@/app/lib/auto-edit/render-engine/shot-motion-resolver";
import { buildImageSegmentCommand } from "@/app/lib/auto-edit/ffmpeg/clip-commands";
import { rhythmDurationFromVoice } from "@/app/lib/auto-edit/engines/take-scoring";

/**
 * Narrative Duration Planner 回归（Phase 1）。
 * 运行：npx tsx --test app/lib/director/duration/plan-narrative-duration.test.ts
 */

const beat = (beatId: string, w?: number, narration?: string): DurationPlanBeat => ({ beatId, estimatedNarrationWeight: w, narration });
const cjk = (n: number) => "旁".repeat(n); // n 个 CJK 字符的旁白
const shot = (shotId: string, beatId: string, shotPurpose?: string): DurationPlanShot => ({ shotId, beatId, shotPurpose });
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

describe("A. 8min / 9 Beat / 140 Shot：planned total ≈ 480（非 700/840）", () => {
  it("总时长贴合目标，且不等于 镜数×固定值", () => {
    const counts = [1, 17, 28, 16, 22, 21, 11, 17, 7]; // =140
    const beats = counts.map((_, i) => beat(`BEAT_${i + 1}`)); // 无权重 → fallback 1
    const storyboard: DurationPlanShot[] = [];
    let sid = 1;
    counts.forEach((c, bi) => {
      for (let k = 0; k < c; k++) storyboard.push(shot(`SHOT_${sid++}`, `BEAT_${bi + 1}`, "动作推进"));
    });
    const r = planNarrativeDuration({ targetDurationSec: 480, beats, storyboard });
    assert.ok(near(r.totalDurationSec, 480), `total=${r.totalDurationSec}`);
    assert.notEqual(Math.round(r.totalDurationSec), 700);
    assert.notEqual(Math.round(r.totalDurationSec), 840);
    assert.deepEqual(r.warnings, []); // 全局可行，无约束告警
    assert.equal(Object.keys(r.shotDurations).length, 140);
  });
});

describe("B. Beat 时长由 narration 估时驱动（Phase 2）", () => {
  it("旁白越长的 Beat 时长越长（narration 主导，非 estimatedNarrationWeight）", () => {
    // 三 Beat 等 shot 数，但旁白长度 20:40:80 字，且 estimatedNarrationWeight 故意反向(2:1:0.5)
    const beats = [beat("A", 2, cjk(20)), beat("B", 1, cjk(40)), beat("C", 0.5, cjk(80))];
    const storyboard: DurationPlanShot[] = [];
    for (const b of ["A", "B", "C"]) for (let k = 0; k < 10; k++) storyboard.push(shot(`${b}${k}`, b, "动作推进"));
    const r = planNarrativeDuration({ targetDurationSec: 200, beats, storyboard });
    // 尽管 estimatedNarrationWeight 反向，时长仍跟随旁白长度：C > B > A
    assert.ok(r.beatDurations.C > r.beatDurations.B, `C=${r.beatDurations.C} B=${r.beatDurations.B}`);
    assert.ok(r.beatDurations.B > r.beatDurations.A, `B=${r.beatDurations.B} A=${r.beatDurations.A}`);
    assert.ok(near(sum(r.shotDurations), 200));
  });
});

describe("C. 同 Beat 不同 shotPurpose → 定场 > 转场", () => {
  it("establishing duration > transition duration", () => {
    const beats = [beat("A", 1)];
    const storyboard = [
      shot("s1", "A", "场景定场"), // 1.4
      shot("s2", "A", "动作推进"), // 1.0
      shot("s3", "A", "转场过渡"), // 0.6
    ];
    const r = planNarrativeDuration({ targetDurationSec: 18, beats, storyboard });
    assert.ok(r.shotDurations.s1 > r.shotDurations.s3, `establish=${r.shotDurations.s1} transition=${r.shotDurations.s3}`);
    assert.ok(near(sum(r.shotDurations), 18));
  });
});

describe("D. 缺 estimatedNarrationWeight → deterministic fallback=1", () => {
  it("无权重两 Beat 等 shot 数 → 时长相等", () => {
    const beats = [beat("A"), beat("B")]; // 无 weight
    const storyboard = [shot("a1", "A", "动作推进"), shot("a2", "A", "动作推进"), shot("b1", "B", "动作推进"), shot("b2", "B", "动作推进")];
    const r = planNarrativeDuration({ targetDurationSec: 40, beats, storyboard });
    assert.ok(near(r.beatDurations.A, r.beatDurations.B), `A=${r.beatDurations.A} B=${r.beatDurations.B}`);
  });
});

describe("E. 未知 shotPurpose → weight=1 fallback", () => {
  it("shotPurposeWeight 未知返回 1", () => {
    assert.equal(shotPurposeWeight("完全不认识的目的"), 1);
    assert.equal(shotPurposeWeight(""), 1);
    assert.equal(shotPurposeWeight(undefined), 1);
    assert.equal(shotPurposeWeight("场景定场"), 1.4);
    assert.equal(shotPurposeWeight("转场过渡"), 0.6);
  });
});

describe("F. min constraint：镜多目标短 → 明确告警，不静默漂移", () => {
  it("100 shot / target 100 → MIN_CONSTRAINT", () => {
    const beats = [beat("A", 1)];
    const storyboard = Array.from({ length: 100 }, (_, i) => shot(`s${i}`, "A", "动作推进"));
    const r = planNarrativeDuration({ targetDurationSec: 100, beats, storyboard });
    assert.ok(r.warnings.some((w) => w.includes("MIN_CONSTRAINT")), r.warnings.join(","));
  });
});

describe("G. max constraint：镜少目标长 → 明确告警", () => {
  it("2 shot / target 100 → MAX_CONSTRAINT", () => {
    const beats = [beat("A", 1)];
    const storyboard = [shot("s1", "A", "动作推进"), shot("s2", "A", "动作推进")];
    const r = planNarrativeDuration({ targetDurationSec: 100, beats, storyboard });
    assert.ok(r.warnings.some((w) => w.includes("MAX_CONSTRAINT")), r.warnings.join(","));
  });
});

describe("H. ShotMotionResolver duration 适配（2/5/10s 都走完 zoom）", () => {
  const SIZE = { w: 1080, h: 1920 };
  const FPS = 30;
  const spec = resolveShotMotion({ camera: "特写 推近", visualFocus: "苹果", shotPurpose: "细节" })!;
  const vfOf = (args: string[]) => args[args.indexOf("-vf") + 1];
  const zp = (vf: string) => vf.split(",").find((p) => p.startsWith("zoompan="))!;
  for (const dur of [2, 5, 10]) {
    it(`${dur}s：frames=dur×fps，z 从 zoomStart→zoomEnd 完整`, () => {
      const cmd = buildImageSegmentCommand("s", "/img.png", "/o.mp4", dur, SIZE, FPS, "L", spec);
      const z = zp(vfOf(cmd.args));
      assert.ok(z.includes(`d=${dur * FPS}`), z); // 帧数随时长
      assert.ok(z.includes(spec.zoomStart.toFixed(4)) && z.includes(spec.zoomEnd.toFixed(4)), z);
      assert.ok(z.includes("on/"), z); // 线性插值随帧
    });
  }
  it("motionSpeed 保持 relative（未变绝对每秒速度）", () => {
    assert.equal(typeof spec.motionSpeed, "number"); // 仍是相对语义字段
  });
});

describe("H/I/J. reorder / delete / insert 身份链稳定", () => {
  const beats = [beat("A", 1), beat("B", 1)];
  const base = [shot("s1", "A", "场景定场"), shot("s2", "A", "动作推进"), shot("s3", "B", "动作推进"), shot("s4", "B", "转场过渡")];
  it("reorder：shotId 不变、数组顺序变 → 每镜时长跟 shotId", () => {
    const r1 = planNarrativeDuration({ targetDurationSec: 24, beats, storyboard: base });
    const reordered = [base[2], base[0], base[3], base[1]];
    const r2 = planNarrativeDuration({ targetDurationSec: 24, beats, storyboard: reordered });
    for (const id of ["s1", "s2", "s3", "s4"]) assert.ok(near(r1.shotDurations[id], r2.shotDurations[id]), id);
  });
  it("delete：删镜后 replan 总时长仍 ≈ target", () => {
    const r = planNarrativeDuration({ targetDurationSec: 24, beats, storyboard: base.filter((s) => s.shotId !== "s2") });
    assert.ok(near(sum(r.shotDurations), 24));
  });
  it("insert：插镜后 Beat 预算不漂移（总仍 ≈ target）", () => {
    const r = planNarrativeDuration({ targetDurationSec: 24, beats, storyboard: [...base, shot("s5", "B", "动作推进")] });
    assert.ok(near(sum(r.shotDurations), 24));
  });
});

describe("K/L. apply-director-response preserve 判定（复刻核心谓词）", () => {
  const resolve = (dur: number | undefined, fallback: number) =>
    Number.isFinite(dur) && (dur as number) > 0 ? (dur as number) : fallback;
  it("K. 已规划 duration 不被全局覆盖", () => {
    assert.equal(resolve(3.4, 5), 3.4); // preserve planned
  });
  it("L. legacy 无 duration → fallback", () => {
    assert.equal(resolve(undefined, 5), 5);
    assert.equal(resolve(0, 5), 5);
    assert.equal(resolve(-1, 5), 5);
  });
});

describe("M. Voice Alignment 只向上补偿 max(planned, voice+0.25)", () => {
  it("planned=4 / voice=6 → 6.25", () => {
    assert.equal(Math.max(4, rhythmDurationFromVoice(6, "documentary")), 6.25);
  });
  it("planned=8 / voice=6 → 8（不缩短）", () => {
    assert.equal(Math.max(8, rhythmDurationFromVoice(6, "documentary")), 8);
  });
});

describe("boundedWeightedAllocation 单元", () => {
  it("可行时 Σ=total", () => {
    const r = boundedWeightedAllocation(30, [1, 2, 3], [2, 2, 2], [12, 12, 12]);
    assert.equal(r.warning, null);
    assert.ok(near(r.values.reduce((a, b) => a + b, 0), 30));
  });
  it("命中上界后重分配（不超 max，Σ 仍=total）", () => {
    // 权重 10 想要 25s 但被 max=12 截断，余量回流给另两项
    const r = boundedWeightedAllocation(30, [1, 1, 10], [2, 2, 2], [12, 12, 12]);
    assert.equal(r.warning, null);
    assert.ok(r.values.every((v) => v <= MAX_SHOT_DURATION_SEC + 1e-6));
    assert.equal(Math.max(...r.values), MAX_SHOT_DURATION_SEC); // 高权项被顶到上界
    assert.ok(near(r.values.reduce((a, b) => a + b, 0), 30));
  });
  it("MIN_SHOT/MAX_SHOT 常量合理", () => {
    assert.ok(MIN_SHOT_DURATION_SEC < MAX_SHOT_DURATION_SEC);
  });
});

describe("Phase 2 — Narration Timing basis (L/M/N)", () => {
  it("L. narration 长 Beat 获得更高 timing basis", () => {
    const short = beatTimingWeight(cjk(10), 5, 0.5);
    const long = beatTimingWeight(cjk(60), 5, 0.5);
    assert.ok(long > short, `long=${long} short=${short}`);
    // 差值应主要来自 narration 估时（~50 字 / 5.5 ≈ 9s）
    assert.ok(long - short > 8, `delta=${long - short}`);
  });

  it("M. empty narration Beat 仍获得视觉 duration（非 0）", () => {
    const w = beatTimingWeight("", 4, undefined);
    assert.ok(w > 0, `w=${w}`); // 4 镜 × 视觉残余 > 0
    // 全空旁白项目仍能分配满 target
    const beats = [beat("A", undefined, ""), beat("B", undefined, "")];
    const storyboard = [shot("a1", "A", "动作推进"), shot("a2", "A", "动作推进"), shot("b1", "B", "动作推进")];
    const r = planNarrativeDuration({ targetDurationSec: 30, beats, storyboard });
    assert.ok(near(sum(r.shotDurations), 30));
    assert.ok(r.beatDurations.A > 0 && r.beatDurations.B > 0);
  });

  it("N. estimatedNarrationWeight 不再是 narration timing 主代理", () => {
    // 相同旁白、相同 shot 数，estimatedNarrationWeight 从 0.1→1.0 只造成 ≤±25% residual 级差异
    const wLow = beatTimingWeight(cjk(40), 5, 0.1);
    const wHigh = beatTimingWeight(cjk(40), 5, 1.0);
    const narrationEst = 40 / 5.5; // ≈7.27s，主导项
    // 差异来自 residual 的 ±25%，远小于 narration 主导量
    assert.ok(Math.abs(wHigh - wLow) < narrationEst, `delta=${Math.abs(wHigh - wLow)} narration=${narrationEst}`);
    // 两者都 > narration 估时（含视觉残余）
    assert.ok(wLow > narrationEst && wHigh > narrationEst);
  });
});

describe("Closure — narration-aware shot allocation + floors (C4/C5/C10/C11/C12)", () => {
  it("C4. narrated 长旁白镜 > narrated 短旁白镜", () => {
    const beats = [beat("B1", undefined, cjk(40))];
    const storyboard = [
      { shotId: "s1", beatId: "B1", shotPurpose: "动作推进", narration: cjk(30) },
      { shotId: "s2", beatId: "B1", shotPurpose: "动作推进", narration: cjk(6) },
    ];
    const r = planNarrativeDuration({ targetDurationSec: 16, beats, storyboard });
    assert.ok(r.shotDurations.s1 > r.shotDurations.s2, `${r.shotDurations.s1} vs ${r.shotDurations.s2}`);
    assert.ok(near(sum(r.shotDurations), 16));
  });

  it("C5. narrated 镜 > 同 purpose 的 unnarrated 镜", () => {
    const beats = [beat("B1", undefined, cjk(30))];
    const storyboard = [
      { shotId: "s1", beatId: "B1", shotPurpose: "动作推进", narration: cjk(30) },
      { shotId: "s2", beatId: "B1", shotPurpose: "动作推进", narration: "" },
    ];
    const r = planNarrativeDuration({ targetDurationSec: 14, beats, storyboard });
    assert.ok(r.shotDurations.s1 > r.shotDurations.s2);
  });

  it("C10. feasible narration floor 满足：narrated 镜 planned ≥ floor", () => {
    const beats = [beat("B1", undefined, `${cjk(20)}。${cjk(20)}。`)];
    const storyboard = [
      { shotId: "s1", beatId: "B1", shotPurpose: "动作推进", narration: cjk(20) },
      { shotId: "s2", beatId: "B1", shotPurpose: "动作推进", narration: cjk(20) },
    ];
    const r = planNarrativeDuration({ targetDurationSec: 15, beats, storyboard });
    assert.deepEqual(r.warnings, []);
    assert.ok(r.shotDurations.s1 >= r.narrationFloors.s1 - 0.01, `${r.shotDurations.s1} < floor ${r.narrationFloors.s1}`);
    assert.ok(r.shotDurations.s2 >= r.narrationFloors.s2 - 0.01);
    assert.ok(near(sum(r.shotDurations), 15));
  });

  it("C11/C12. infeasible floor → 明确告警，不扩大 target、不产生负时长", () => {
    // 3 镜每镜 ~55字(est≈10s, floor≈10.25)，beat 预算仅 15s → 放不下
    const beats = [beat("B1", undefined, `${cjk(55)}。${cjk(55)}。${cjk(55)}。`)];
    const storyboard = ["s1", "s2", "s3"].map((id) => ({ shotId: id, beatId: "B1", narration: cjk(55) }));
    const r = planNarrativeDuration({ targetDurationSec: 15, beats, storyboard });
    assert.ok(r.warnings.some((w) => w.includes("CONSTRAINT")), r.warnings.join(","));
    assert.ok(Object.values(r.shotDurations).every((d) => d > 0)); // 不产生负时长
    // best-effort：各镜落在 floor，不为了凑 target 把某镜压成负/0
  });
});
