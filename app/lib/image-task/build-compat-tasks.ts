import type { BuildCompatImageTasksInput, BuildCompatImageTasksResult, ImageTask } from "./types";
import { imageTaskIdFromIndex, shotIdFromIndex } from "./shot-id";

/**
 * 1:1 兼容 ImageTask 构建：每个 Storyboard Shot → 一个 ImageTask。
 * 输出图片数量 / 评分次数与升级前一致。
 */
export function buildCompatImageTasksFromDirector(
  input: BuildCompatImageTasksInput
): BuildCompatImageTasksResult {
  const { director } = input;
  const count = Math.max(director.storyboard.length, director.prompts.length);
  const imageTasks: ImageTask[] = [];
  const shotToImageTaskMap: Record<string, string> = {};
  const imageTaskToShotIds: Record<string, string[]> = {};

  const storyboardWithShotIds = director.storyboard.map((sb, i) => ({
    ...sb,
    shotId: sb.shotId ?? shotIdFromIndex(i),
  }));

  for (let i = 0; i < count; i++) {
    const sb = storyboardWithShotIds[i] ?? director.storyboard[i];
    const prompt = director.prompts[i]?.providerPrompt ?? "";
    const shotId = sb?.shotId ?? shotIdFromIndex(i);
    const taskId = imageTaskIdFromIndex(i);

    const task: ImageTask = {
      imageTaskId: taskId,
      primaryShotId: shotId,
      supportingShotIds: [],
      sourceShotIndexes: [i],
      character: sb?.character ?? "未指定",
      actionCoverage: sb?.action ? [sb.action] : [],
      environment: sb?.environment ?? "未指定环境",
      cameraIntent: sb?.camera ?? "中景固定镜头",
      visualFocus: [sb?.action?.slice(0, 24) || "character"],
      priority: "normal",
      budgetReason: "compat-1:1-storyboard-shot",
      providerPrompt: prompt,
    };

    imageTasks.push(task);
    shotToImageTaskMap[shotId] = taskId;
    imageTaskToShotIds[taskId] = [shotId];
  }

  return {
    imageTasks,
    mapping: { shotToImageTaskMap, imageTaskToShotIds },
    storyboardWithShotIds,
  };
}

/** 演示：120 Narrative Shots → 40 ImageTasks（本 Phase 不执行 Planner，仅验证数据结构） */
export function demoManyToOneMapping(
  narrativeShotCount: number,
  imageTaskCount: number
): { shotToImageTaskMap: Record<string, string>; imageTaskToShotIds: Record<string, string[]> } {
  const shotToImageTaskMap: Record<string, string> = {};
  const imageTaskToShotIds: Record<string, string[]> = {};
  const shotsPerTask = Math.ceil(narrativeShotCount / imageTaskCount);

  for (let t = 0; t < imageTaskCount; t++) {
    const taskId = imageTaskIdFromIndex(t);
    imageTaskToShotIds[taskId] = [];
    for (let j = 0; j < shotsPerTask; j++) {
      const shotIdx = t * shotsPerTask + j;
      if (shotIdx >= narrativeShotCount) break;
      const shotId = shotIdFromIndex(shotIdx);
      shotToImageTaskMap[shotId] = taskId;
      imageTaskToShotIds[taskId].push(shotId);
    }
  }
  return { shotToImageTaskMap, imageTaskToShotIds };
}
