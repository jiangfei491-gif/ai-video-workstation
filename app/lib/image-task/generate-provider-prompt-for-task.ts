import { composeImageTaskPrompt } from "./compose-task-prompt";
import type { DirectorStoryboardShot } from "@/app/lib/director/types";
import type { ImageTask } from "./types";

export type ResolveImageTaskPromptInput = {
  task: ImageTask;
  storyboard?: DirectorStoryboardShot[];
  projectStyle?: string;
  previousShotSummary?: string;
};

/**
 * ImageTask 级 Provider Prompt：综合 primary/supporting/actionCoverage/visualFocus。
 */
export function resolveProviderPromptForImageTask(
  task: ImageTask,
  ctx?: Omit<ResolveImageTaskPromptInput, "task">
): string {
  const prebuilt = task.providerPrompt?.trim();
  if (prebuilt && !task.supportingShotIds.length && ctx?.storyboard == null) {
    return prebuilt;
  }

  if (ctx?.storyboard?.length) {
    return composeImageTaskPrompt(task, ctx.storyboard, {
      projectStyle: ctx.projectStyle,
      previousShotSummary: ctx.previousShotSummary,
    });
  }

  if (prebuilt) return prebuilt;

  return composeImageTaskPrompt(
    task,
    task.sourceShotIndexes.map((idx, i) => ({
      shotId: i === 0 ? task.primaryShotId : task.supportingShotIds[i - 1] ?? task.primaryShotId,
      sceneNumber: idx + 1,
      duration: 6,
      character: task.character,
      action: task.actionCoverage[i] ?? task.actionCoverage[0] ?? "",
      environment: task.environment,
      camera: task.cameraIntent,
      narration: "",
      transition: "Cut",
    }))
  );
}

/** @deprecated 别名 */
export const generateProviderPromptForImageTask = resolveProviderPromptForImageTask;
