import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveClipMedia } from "./build-sequence";
import type { BuildEditInput } from "./types";

/**
 * 档位 0 回归：IMAGE 主链稳定身份取图（shotId → imageTaskId → imageTaskFrames）。
 * 运行：npx tsx --test app/lib/auto-edit/resolve-clip-media.test.ts
 */

// 稳定身份资产（正确图）
const imageTaskFrames: Record<string, string> = {
  IMAGE_TASK_001: "asset://task1",
  IMAGE_TASK_002: "asset://task2", // SHOT_002 与 SHOT_003 共用
};
const shotToImageTaskMap: Record<string, string> = {
  SHOT_001: "IMAGE_TASK_001",
  SHOT_002: "IMAGE_TASK_002",
  SHOT_003: "IMAGE_TASK_002",
};
// legacy shotFrames：故意放"按 index 会取错"的旧数据
const shotFrames: Record<number, string> = {
  0: "legacy://idx0",
  1: "legacy://idx1",
  2: "legacy://idx2",
  5: "legacy://idx5-WRONG",
};

const input = {
  batchResults: {} as BuildEditInput["batchResults"],
  shotFrames,
  imageTaskFrames,
  shotToImageTaskMap,
} satisfies Pick<
  BuildEditInput,
  "batchResults" | "shotFrames" | "imageTaskFrames" | "shotToImageTaskMap"
>;

const media = (shotIndex: number, shotId?: string, imageTaskId?: string) =>
  resolveClipMedia({ shotIndex, shotId, imageTaskId, input }).mediaUrl;

describe("resolveClipMedia — IMAGE 稳定身份取图（档位 0）", () => {
  it("A. 1 ImageTask → 1 Shot：取 task 资产而非 legacy index", () => {
    assert.equal(media(0, "SHOT_001", "IMAGE_TASK_001"), "asset://task1");
  });

  it("B. 1 ImageTask → N Shots：多镜复用同一 asset", () => {
    const b2 = media(1, "SHOT_002", "IMAGE_TASK_002");
    const b3 = media(2, "SHOT_003", "IMAGE_TASK_002");
    assert.equal(b2, "asset://task2");
    assert.equal(b3, "asset://task2");
    assert.equal(b2, b3);
  });

  it("C. Reorder：shotIndex 变、shotId/imageTaskId 不变 → 取图不变", () => {
    // SHOT_001 移到 index5（legacy idx5 是错图）
    assert.equal(media(5, "SHOT_001", "IMAGE_TASK_001"), "asset://task1");
  });

  it("D. Delete：首镜删除后 index 左移，不取错图", () => {
    // SHOT_002 左移到 index0；legacy shotFrames[0] 属于旧 shot0（错）
    assert.equal(media(0, "SHOT_002", "IMAGE_TASK_002"), "asset://task2");
  });

  it("E. Insert：头部插入后 index 右移，不错位", () => {
    // SHOT_001 右移到 index1；legacy shotFrames[1] 属于别的镜（错）
    assert.equal(media(1, "SHOT_001", "IMAGE_TASK_001"), "asset://task1");
  });

  it("F. Legacy fallback：无身份 / imageTaskFrames 缺失 → shotFrames[index]", () => {
    assert.equal(media(0), "legacy://idx0"); // 无 shotId/imageTaskId
    assert.equal(media(2, undefined, "IMAGE_TASK_999"), "legacy://idx2"); // imageTaskId 未命中
    assert.equal(media(1, "UNKNOWN_SHOT"), "legacy://idx1"); // shotId 无映射
  });

  it("G. 第二优先：仅 shotId → 经 mapping 反查 imageTaskId", () => {
    assert.equal(media(0, "SHOT_001"), "asset://task1");
  });

  it("H. video 模式保留：batchResults.videoUrl 优先，不被破坏", () => {
    const videoInput = {
      ...input,
      batchResults: {
        0: { status: "success", videoUrl: "video://v0", firstFrameUrl: null },
      } as BuildEditInput["batchResults"],
    };
    assert.equal(
      resolveClipMedia({
        shotIndex: 0,
        shotId: "SHOT_001",
        imageTaskId: "IMAGE_TASK_001",
        input: videoInput,
      }).mediaUrl,
      "video://v0"
    );
  });
});
