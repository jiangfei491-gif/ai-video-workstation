/**
 * ImageTask 1:1 兼容模式单元测试（不调用 OpenAI / 不生图）
 * 运行：npx tsx scripts/test-image-task-compat.ts
 */
import {
  buildCompatImageTasksFromDirector,
  demoManyToOneMapping,
  resolveFrameForShot,
  dualWriteGenerationResult,
} from "../app/lib/image-task";
import type { DirectorState } from "../app/lib/workbench-persist/types";

function mockDirector(shotCount: number): DirectorState {
  const storyboard = Array.from({ length: shotCount }, (_, i) => ({
    sceneNumber: i + 1,
    duration: 6,
    character: `角色${i + 1}`,
    action: `动作${i + 1}`,
    environment: "测试环境",
    camera: "中景",
    narration: `口播${i + 1}`,
  }));
  const prompts = storyboard.map((s) => ({
    sceneNumber: s.sceneNumber,
    providerPrompt: `Prompt for shot ${s.sceneNumber}`,
    duration: 6,
  }));
  return { title: "测试", script: "脚本", storyboard, prompts };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const shotCount = 30;
  const director = mockDirector(shotCount);
  const { imageTasks, mapping, storyboardWithShotIds } =
    buildCompatImageTasksFromDirector({ director });

  assert(imageTasks.length === shotCount, `ImageTask 数量应为 ${shotCount}`);
  assert(
    Object.keys(mapping.shotToImageTaskMap).length === shotCount,
    "shotToImageTaskMap 应为 1:1"
  );
  assert(storyboardWithShotIds.every((s) => s.shotId), "每个 storyboard 应有 shotId");

  for (let i = 0; i < shotCount; i++) {
    const shotId = storyboardWithShotIds[i].shotId!;
    assert(mapping.shotToImageTaskMap[shotId] === `IMAGE_TASK_${String(i + 1).padStart(3, "0")}`, `映射 SHOT ${i + 1}`);
    assert(imageTasks[i].sourceShotIndexes[0] === i, `sourceShotIndexes[0] === ${i}`);
    assert(imageTasks[i].providerPrompt === director.prompts[i].providerPrompt, "providerPrompt 复制");
  }

  // 双写验证
  const task = imageTasks[0];
  const patch = dualWriteGenerationResult({
    task,
    frame: { url: "http://test/frame0.png", assetId: "img-0" },
    prev: {
      shotFrames: {},
      shotFrameAssets: {},
      shotImageMeta: {},
      shotTimeline: {},
      imageTaskFrames: {},
      imageTaskFrameAssets: {},
      imageTaskTimeline: {},
    },
  });
  assert(patch.imageTaskFrames?.[task.imageTaskId] === "http://test/frame0.png", "imageTaskFrames 写入");
  assert(patch.shotFrames?.[0] === "http://test/frame0.png", "shotFrames 双写");

  const state = {
    shotFrames: patch.shotFrames ?? {},
    imageTaskFrames: patch.imageTaskFrames ?? {},
    imageTaskMapping: mapping,
    director: { ...director, storyboard: storyboardWithShotIds },
  };
  assert(resolveFrameForShot(state, 0) === "http://test/frame0.png", "resolveFrameForShot");

  // 120 → 40 数据结构演示（不执行 Planner）
  const demo = demoManyToOneMapping(120, 40);
  assert(Object.keys(demo.shotToImageTaskMap).length === 120, "120 shots mapped");
  assert(Object.keys(demo.imageTaskToShotIds).length === 40, "40 image tasks");

  console.log("PASS: ImageTask 1:1 兼容测试");
  console.log(`  ${shotCount} Storyboard Shots → ${imageTasks.length} ImageTasks → ${imageTasks.length} generation units`);
  console.log(`  120→40 映射演示: ${Object.keys(demo.shotToImageTaskMap).length} shots / ${Object.keys(demo.imageTaskToShotIds).length} tasks`);
}

main();
