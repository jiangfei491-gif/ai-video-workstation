import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildShotNarrationMap } from "./align-voice-subtitle";
import { buildMediaPool } from "../edit-graph/build-media-pool";
import type { BuildEditInput } from "../types";

/**
 * Phase 2B 回归：视觉描述(action/environment)不得被当旁白 TTS。
 * 运行：npx tsx --test app/lib/auto-edit/audio/narration-map.test.ts
 */

function mkInput(params: {
  script: string;
  shots: { action?: string; environment?: string; narration?: string; narrationRef?: string }[];
}): BuildEditInput {
  return {
    topic: "t",
    script: params.script,
    storyboard: params.shots.map((s, i) => ({
      shotIndex: i,
      duration: 4,
      action: s.action ?? "",
      environment: s.environment ?? "",
      camera: "",
      narration: s.narration ?? "",
      shotId: `SHOT_${i + 1}`,
      beatId: "BEAT_001",
      narrationRef: s.narrationRef,
    })),
    sections: [],
    shotPositions: {},
    narrativeEdges: [],
    castLinks: [],
    shotFrames: {},
    batchResults: {},
    fps: 30,
    aspectRatio: "9:16",
  } as unknown as BuildEditInput;
}

const narratedCount = (m: Map<number, string>) => [...m.values()].filter((t) => t.trim()).length;
const voiceCount = (input: BuildEditInput) =>
  buildMediaPool(input).filter((it) => it.kind === "voice").length;

describe("Phase 2B — Narration Mapping（视觉描述不入旁白）", () => {
  it("H. 2 phrases / 5 shots → 只有 2 个镜头有旁白", () => {
    const input = mkInput({
      script: "第一句旁白内容。第二句旁白内容。",
      shots: Array.from({ length: 5 }, () => ({ action: "苹果特写", environment: "厨房" })),
    });
    const map = buildShotNarrationMap(input);
    assert.equal(narratedCount(map), 2);
    assert.equal(map.get(0)!.trim().length > 0, true);
    assert.equal(map.get(1)!.trim().length > 0, true);
    assert.equal(map.get(2), ""); // 用尽 → 空
    assert.equal(map.get(3), "");
    assert.equal(map.get(4), "");
    assert.equal(voiceCount(input), 2); // TTS 请求数 = 2，不是 5
  });

  it("I. 0 phrases / 5 shots → 0 旁白，0 voice clip", () => {
    const input = mkInput({
      script: "",
      shots: Array.from({ length: 5 }, () => ({ action: "苹果特写 镜头缓慢推进", environment: "果园" })),
    });
    const map = buildShotNarrationMap(input);
    assert.equal(narratedCount(map), 0);
    assert.equal(voiceCount(input), 0); // action/environment 非空也不生成 voice
  });

  it("J. action / environment 不得进入 narration", () => {
    const input = mkInput({
      script: "唯一一句旁白。",
      shots: [
        { action: "苹果特写", environment: "厨房" }, // 拿到 phrase
        { action: "镜头缓慢推进", environment: "果园" }, // 无 phrase → 空，绝不取 action
      ],
    });
    const map = buildShotNarrationMap(input);
    assert.equal(map.get(1), ""); // 不是 "镜头缓慢推进 · 果园"
    assert.ok(!(map.get(1) ?? "").includes("镜头"));
    assert.ok(!(map.get(1) ?? "").includes("果园"));
  });

  it("K. narrationRef=beatId 不得作为 narration text", () => {
    const input = mkInput({
      script: "",
      shots: [{ narrationRef: "BEAT_001", action: "苹果特写" }],
    });
    const map = buildShotNarrationMap(input);
    assert.equal(map.get(0), ""); // narrationRef 只是 lineage，不是文本
    assert.ok(!(map.get(0) ?? "").includes("BEAT"));
  });
});
